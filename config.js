// Налаштування хмарного збереження (Supabase).
// Обидва значення беруться в проєкті: Settings → API.
// Публічний ключ (anon) безпечно тримати у відкритому коді:
// доступ до даних захищає Row Level Security зі schema.sql.
window.CLOUD = {
  url: '',      // напр. https://abcdefghijk.supabase.co
  anonKey: '',  // довгий рядок, що починається з eyJ...
};
