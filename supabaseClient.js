// ملف الاتصال المركزي بسوبابيز - الفرات فارما
const supabaseUrl = 'https://sidtdxchiqiogfkwbdui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZHRkeGNoaXFpb2dma3diZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTEyMTAsImV4cCI6MjA4OTY4NzIxMH0.QF1-67Qu2HfWJt3ANSegM87fykOYQBwqC7ggLG8LTVU';

// للاستخدام المباشر في HTML (CDN)
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);
