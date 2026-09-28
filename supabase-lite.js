/**
 * supabase-lite.js - عميل PostgREST مصغّر (بديل supabase-js v2)
 * ==============================================================
 * الموقع كان بيحمّل supabase-js من CDN (~29 KiB مضغوط) عشان يعمل 3 حاجات بس:
 *   from().select() / insert() / upsert() / rpc()
 * وsupabase-js جواه auth + realtime + storage + postgrest كامل، فأكتر من نصه
 * كان بيتحمّل ومبيتستخدمش خالص (Lighthouse: 20.3 KiB unused).
 *
 * الملف ده بيغطي نفس الـ API المتستخدم في المشروع بالظبط (نفس أسماء الدوال،
 * نفس شكل الـ Promise { data, error }) فمفيش أي تغيير مطلوب في الكود المستخدم.
 *
 * ملحوظة مهمة: المفتاح هنا anon ومقصود إنه يكون في كود الواجهة (الم.access
 * map + RLS هما اللي بيحموا البيانات). العميل ده مش بيوفّر حماية إضافية.
 */
(function (global) {
    'use strict';

    // ==========================================
    // أدوات
    // ==========================================
    // PostgREST بيرجّع أخطاء JSON بالشكل ده:
    //   { code: '23505', details: '...', hint: null, message: '...' }
    // بنلفّها في object بنفس اسم message/code/details عشان الكود الموجود
    // (زي فحص WELCOME10_ALREADY_USED و 23505 في order-status.js) يشتغل زي ما هو.
    function toError(payload, status) {
        if (payload && typeof payload === 'object' && (payload.message || payload.code)) {
            return {
                message: payload.message || ('HTTP ' + status),
                code: payload.code || '',
                details: payload.details || '',
                hint: payload.hint || '',
                status: status
            };
        }
        return {
            message: typeof payload === 'string' && payload ? payload : ('HTTP ' + status),
            code: '', details: '', hint: '', status: status
        };
    }

    function escapeInValue(v) {
        return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }

    // ==========================================
    // Query Builder
    // ==========================================
    function Query(client, method, table) {
        this._client = client;
        this._method = method;
        this._table = table;
        this._params = [];
        this._headers = {};
        this._body = undefined;
        this._prefer = [];
        this._single = null; // null | 'single' | 'maybeSingle'
    }

    Query.prototype._setParam = function (key, value) {
        this._params.push([key, value]);
        return this;
    };

    Query.prototype.select = function (columns) {
        this._setParam('select', columns === undefined || columns === null || columns === ''
            ? '*'
            : String(columns).trim());
        // بعد insert/upsert/update لازم نطلب من السيرفر يرجّع الصفوف عشان الـ select يبقى ليه معنى
        if (this._method !== 'GET' && this._method !== 'DELETE') this._returnRepresentation();
        return this;
    };

    Query.prototype._returnRepresentation = function () {
        if (this._prefer.indexOf('return=representation') === -1) this._prefer.push('return=representation');
    };

    Query.prototype.insert = function (rows) {
        this._method = 'POST';
        this._body = Array.isArray(rows) ? rows : [rows];
        return this;
    };

    Query.prototype.upsert = function (row, options) {
        this._method = 'POST';
        this._body = Array.isArray(row) ? row : [row];
        this._prefer.push('resolution=merge-duplicates');
        if (options && options.onConflict) this._setParam('on_conflict', options.onConflict);
        return this;
    };

    Query.prototype.update = function (changes) {
        this._method = 'PATCH';
        this._body = changes;
        return this;
    };

    Query.prototype.delete = function () {
        this._method = 'DELETE';
        return this;
    };

    // ---- الفلاتر (بتتحوّل لـ query params زي ما PostgREST متوقع) ----
    function addFilter(query, op, column, value) {
        if (value === null || value === undefined) {
            return query.is(column, null);
        }
        return query._setParam(column, op + '.' + value);
    }

    Query.prototype.eq = function (column, value) { return addFilter(this, 'eq', column, value); };
    Query.prototype.neq = function (column, value) { return addFilter(this, 'neq', column, value); };
    Query.prototype.gt = function (column, value) { return addFilter(this, 'gt', column, value); };
    Query.prototype.gte = function (column, value) { return addFilter(this, 'gte', column, value); };
    Query.prototype.lt = function (column, value) { return addFilter(this, 'lt', column, value); };
    Query.prototype.lte = function (column, value) { return addFilter(this, 'lte', column, value); };

    Query.prototype.is = function (column, value) {
        this._setParam(column, value === null ? 'is.null' : 'is.' + value);
        return this;
    };

    Query.prototype.like = function (column, pattern) { return addFilter(this, 'like', column, pattern); };
    Query.prototype.ilike = function (column, pattern) { return addFilter(this, 'ilike', column, pattern); };

    Query.prototype.in = function (column, values) {
        const list = (Array.isArray(values) ? values : Array.prototype.slice.call(arguments[1] || []))
            .map(escapeInValue).join(',');
        this._setParam(column, 'in.(' + list + ')');
        return this;
    };

    Query.prototype.match = function (conditions) {
        const self = this;
        Object.keys(conditions || {}).forEach(function (key) {
            self.eq(key, conditions[key]);
        });
        return this;
    };

    Query.prototype.order = function (column, options) {
        const opts = options || {};
        const dir = opts.ascending === false || opts.descending === true || opts.order === 'desc'
            ? 'desc' : 'asc';
        const nullsFirst = opts.nullsFirst ? '.nullsfirst' : (opts.nullsLast ? '.nullslast' : '');
        const existing = this._params.filter(function (p) { return p[0] === 'order'; });
        const current = existing.length ? existing[existing.length - 1][1] : '';
        const next = (current ? current + ',' : '') + column + '.' + dir + nullsFirst;
        if (existing.length) this._params.splice(this._params.indexOf(existing[existing.length - 1]), 1);
        return this._setParam('order', next);
    };

    Query.prototype.limit = function (count) {
        return this._setParam('limit', String(count));
    };

    Query.prototype.range = function (from, to) {
        this._headers['Range-Unit'] = 'items';
        this._headers['Range'] = String(from) + '-' + String(to);
        return this;
    };

    // بنطلب الداتا زي supabase-js بالظبط:
    // single()      → لازم صف واحد بالظبط، غير كده error PGRST116
    // maybeSingle() → 0 صفوف = null من غير error، أكتر من صف = error
    Query.prototype.single = function () { this._single = 'single'; return this; };
    Query.prototype.maybeSingle = function () { this._single = 'maybeSingle'; return this; };

    Query.prototype.count = function (countType) {
        this._headers['Prefer'] = (this._headers['Prefer'] ? this._headers['Prefer'] + ', ' : '')
            + 'count=' + (countType || 'exact');
        this._wantCount = true;
        return this;
    };

    Query.prototype._url = function () {
        const search = this._params
            .map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); })
            .join('&');
        // rpc بيبعت لـ /rest/v1/rpc/<name>، عادي بيبعت لـ /rest/v1/<table>
        const path = (this._rpc ? '/rest/v1/rpc/' : '/rest/v1/') + encodeURIComponent(this._table);
        return this._client._url + path + (search ? '?' + search : '');
    };

    Query.prototype._exec = function () {
        const self = this;
        const headers = {
            apikey: this._client._key,
            Authorization: 'Bearer ' + this._client._key,
            Accept: 'application/json'
        };
        Object.keys(this._headers).forEach(function (h) { headers[h] = self._headers[h]; });
        if (this._body !== undefined) headers['Content-Type'] = 'application/json';
        // من غير Prefer for-return بيرجّع السيرفر body فاضي على الإضافات/التعديلات،
        // وده اللي عايزينه في معظم الـ inserts (مفيش select بعدها أصلاً).
        // GET و rpc مش بنلمسهم:GET بيرجّع الصفحات عادي، و rpc بيرجّع قيمة الدالة
        // نفسها — و return=minimal كانت ممكن تضيّعها.
        const prefer = this._prefer.slice();
        if (!this._rpc && this._method !== 'GET' && this._method !== 'DELETE'
            && !prefer.some(function (p) { return p.indexOf('return=') === 0; })) {
            prefer.push('return=minimal');
        }
        if (this._headers['Prefer']) prefer.push(this._headers['Prefer']);
        if (prefer.length) headers['Prefer'] = prefer.join(', ');

        return fetch(this._url(), {
            method: this._method,
            headers: headers,
            body: this._body === undefined ? undefined : JSON.stringify(this._body)
        }).then(function (res) {
            return res.text().then(function (text) {
                let payload = null;
                if (text) { try { payload = JSON.parse(text); } catch (_) { payload = text; } }

                if (!res.ok) {
                    return { data: null, error: toError(payload, res.status), status: res.status };
                }

                // Prefer: return=minimal (أو مفيش select بعد الـ insert) بيرجّع body فاضي
                let data = payload;
                if (data === null || data === '') data = null;

                if (self._single) {
                    const rows = Array.isArray(data) ? data : (data === null ? [] : [data]);
                    if (rows.length === 1) data = rows[0];
                    else if (self._single === 'maybeSingle' && rows.length === 0) data = null;
                    else {
                        return {
                            data: null,
                            error: toError({
                                code: 'PGRST116',
                                message: 'JSON object requested, multiple (or no) rows returned',
                                details: 'Results contain ' + rows.length + ' rows'
                            }, res.status),
                            status: res.status
                        };
                    }
                }

                const out = { data: data, error: null, status: res.status };
                if (self._wantCount) {
                    out.count = (res.headers.get('Content-Range') || '').split('/').pop();
                }
                return out;
            });
        }).catch(function (e) {
            // زي supabase-js: خطأ الشبكة يرجع كـ { data: null, error } مش rejection،
            // عشان الكود اللي بيعمل await/crash على error_placeholder ميتكسرش.
            return {
                data: null,
                error: { message: (e && e.message) || String(e), code: '', details: '', hint: '', status: 0 },
                status: 0
            };
        });
    };

    // مهم:_builder نفسه لازم يكون thenable عشان `await _supabase.from(..)`
    // و `.then(() => {})` يشتغلوا من غير await صريح.
    Query.prototype.then = function (onFulfilled, onRejected) {
        return this._exec().then(onFulfilled, onRejected);
    };
    Query.prototype.catch = function (onRejected) {
        return this._exec().catch(onRejected);
    };
    Query.prototype.finally = function (onFinally) {
        return this._exec().finally(onFinally);
    };

    // ==========================================
    // Client
    // ==========================================
    function createClient(url, key) {
        const base = String(url || '').replace(/\/+$/, '');
        const client = {
            _url: base,
            _key: key,
            from: function (table) { return new Query(client, 'GET', table); },
            rpc: function (fn, args) {
                const q = new Query(client, 'POST', fn);
                q._rpc = true;
                q._body = args || {};
                return q;
            }
        };
        return client;
    }

    global.createSupabaseClient = createClient;
    global.supabaseLite = { createClient: createClient };
})(window);
