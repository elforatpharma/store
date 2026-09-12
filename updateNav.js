const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const navStart = content.indexOf('<nav class="bg-white/90');
const appContainerStart = content.indexOf('<div id="app-container">');

const newNav = 
<!-- Top Announcement Marquee Bar with Shimmer & Live Countdown -->
<div class="bg-gradient-to-r from-[#3312D5] via-[#4D3CEB] to-[#8536FF] text-white py-2 px-4 text-xs font-medium sticky top-0 z-50 shadow-md">
<div class="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
<!-- Live dynamic announcement badge -->
<div class="flex items-center gap-2.5 overflow-hidden">
<span class="badge-shimmer text-white px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase shadow-sm flex items-center gap-1.5">
<span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
        ??? ???? ?????? ??
      </span>
<div class="hidden sm:flex items-center gap-2 text-xs font-semibold">
<span class="">????? ??? ???? ????? ?????? ??????? ??? 500 ?.?</span>
<span class="text-purple-200">|</span>
<span class="text-amber-300 font-bold">??? 20% ????: FORAT20</span>
</div>
</div>
<!-- Contact & Quick stats -->
<div class="flex items-center gap-4 text-xs text-white/95">
<div class="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full">
<span class="text-[10px] text-purple-200">????? ????? ????:</span>
<span class="font-mono font-bold text-amber-300">23:59:49</span>
</div>
<a class="flex items-center gap-1.5 hover:text-amber-300 transition-colors bg-emerald-500/30 hover:bg-emerald-500/50 px-2.5 py-0.5 rounded-full" href="https://wa.me/201146809133" target="_blank">
<i class="fa-brands fa-whatsapp text-emerald-300 text-xs"></i>
<span class="font-mono text-xs">+20 114 680 9133</span>
</a>
<span class="hidden md:inline text-white/30">|</span>
<span class="hidden md:flex items-center gap-1.5"><i class="fa-solid fa-truck-fast text-purple-200"></i> ??? ???? ????? ?????????</span>
</div>
</div>
</div>
<!-- Main Sticky Glass Navbar with Glow & Micro-interactions -->
<header class="sticky top-[37px] md:top-[41px] z-40 glass-nav transition-all duration-300 shadow-sm">
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div class="flex items-center justify-between h-20 gap-4">
<!-- Official Brand Logo & Store Name -->
<div class="flex items-center gap-3 flex-shrink-0">
<a class="flex items-center gap-3 group cursor-pointer" onclick="app.navigate('home')">
<div class="w-13 h-13 rounded-2xl bg-white p-1.5 shadow-sm border border-purple-100/80 flex items-center justify-center overflow-hidden group-hover:shadow-purple-soft transition-all duration-300">
<img alt="???? ??????? ?????" class="w-11 h-11 object-contain transform group-hover:scale-110 transition-transform duration-500" src="logo.png">
</div>
<div class="flex flex-col">
<span class="text-xl md:text-2xl font-black font-display tracking-tight text-darkNavy group-hover:text-primary transition-colors flex items-center gap-1">
              ??????? <span class="text-gradient">?????</span>
</span>
<span class="text-[10px] tracking-widest text-deepGray font-semibold -mt-1 uppercase">ELFORAT PHARMA</span>
</div>
</a>
</div>
<!-- Navigation Links with Hover underline micro-effects -->
<nav id="nav-container" class="hidden lg:flex items-center gap-7 text-sm font-bold text-slate-700">
<a class="nav-link cursor-pointer hover:text-primary transition-colors py-1 relative group" onclick="app.navigate('home')" data-target="home">
          ????????
</a>
<a class="nav-link cursor-pointer hover:text-primary transition-colors py-1 relative group" onclick="app.navigate('catalog')" data-target="catalog">
          ????????
</a>
<a class="nav-link cursor-pointer hover:text-primary transition-colors py-1 relative group" onclick="app.navigate('about')" data-target="about">
          ?? ??????
</a>
</nav>
<!-- Search Bar -->
<div class="hidden md:flex flex-1 max-w-xs xl:max-w-sm mx-2">
<div class="relative w-full group">
<input type="text" id="desktop-search-input" placeholder="???? ?? ????..." class="w-full bg-slate-100/80 hover:bg-white border border-slate-200/80 focus:bg-white text-darkNavy text-xs rounded-full pr-10 pl-4 py-2.5 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-400" oninput="app.handleSearch(this.value)" autocomplete="off">
<div class="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
<i class="fa-solid fa-magnifying-glass text-xs"></i>
</div>
<div id="search-suggestions-desktop" class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 hidden z-50 overflow-hidden"></div>
</div>
</div>
<!-- Action Items: Admin Dashboard, Wishlist, Cart with Counter Glow -->
<div class="flex items-center gap-2.5 sm:gap-3">
<!-- Mobile Menu Button -->
<button id="mobile-menu-btn" class="md:hidden p-2 text-gray-500 hover:text-primary transition-colors" onclick="app.toggleMobileMenu()">
    <i class="fa-solid fa-bars text-lg"></i>
</button>
<!-- Wishlist with Hover scale -->
<button class="btn-fav w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-darkNavy hover:text-rose-500 hover:border-rose-300 transition-all relative shadow-sm" onclick="app.navigate('favorites')">
<i class="fa-regular fa-heart text-base"></i>
<span id="favorites-badge" class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">0</span>
</button>
<!-- Cart with Glow Count -->
<button class="w-10 h-10 rounded-full bg-white border border-purple-200 flex items-center justify-center text-darkNavy hover:text-primary hover:border-primary transition-all relative shadow-sm group" onclick="app.navigate('cart')">
<i class="fa-solid fa-bag-shopping text-base text-primary group-hover:scale-110 transition-transform"></i>
<span id="cart-badge" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-r from-primary to-secondary text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-purple-glow animate-pulse">
            0
          </span>
</button>
</div>
</div>
</div>
</header>
<!-- Mobile Search Bar -->
<div class="p-3 bg-white border-b border-purple-50 md:hidden">
<div class="relative w-full">
<input type="text" id="mobile-search-input" placeholder="???? ?? ????..." class="w-full bg-slate-50 border border-purple-100 text-darkNavy text-xs rounded-full pr-9 pl-4 py-2.5 focus:outline-none focus:border-primary shadow-inner" oninput="app.handleSearch(this.value)" autocomplete="off">
<div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-primary">
<i class="fa-solid fa-magnifying-glass text-xs"></i>
</div>
<div id="search-suggestions-mobile" class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 hidden z-50 overflow-hidden"></div>
</div>
</div>
<!-- Mobile Menu Overlay -->
<div id="mobile-menu-overlay" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden md:hidden" onclick="app.toggleMobileMenu()"></div>
<!-- Mobile Menu Slide Panel -->
<div id="mobile-menu-panel" class="fixed top-0 right-0 h-full w-[280px] bg-white z-[101] transform translate-x-full transition-transform duration-300 ease-in-out md:hidden shadow-2xl">
    <div class="p-6">
        <div class="flex items-center justify-between mb-8">
            <span class="text-xl font-bold text-primary">???????</span>
            <button onclick="app.toggleMobileMenu()" class="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>
        <nav class="space-y-4">
            <a href="javascript:void(0)" onclick="app.navigate('home'); app.toggleMobileMenu();" class="block py-3 px-4 rounded-lg text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors font-bold text-lg">????????</a>
            <a href="javascript:void(0)" onclick="app.navigate('catalog'); app.toggleMobileMenu();" class="block py-3 px-4 rounded-lg text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors font-bold text-lg">????????</a>
            <a href="javascript:void(0)" onclick="app.navigate('favorites'); app.toggleMobileMenu();" class="block py-3 px-4 rounded-lg text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors font-bold text-lg">???????</a>
            <a href="javascript:void(0)" onclick="app.navigate('about'); app.toggleMobileMenu();" class="block py-3 px-4 rounded-lg text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors font-bold text-lg">?? ??????</a>
        </nav>
    </div>
</div>

;

const newContent = content.substring(0, navStart) + newNav + content.substring(appContainerStart);
fs.writeFileSync('index.html', newContent);
console.log('Navbar updated');
