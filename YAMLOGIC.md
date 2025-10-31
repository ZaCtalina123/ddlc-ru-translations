# Схема YAML (логическая)

mods: массив объектов модов.

Поля модов:

- id (string, обяз.): стабильный уникальный идентификатор записи (например, слаг).
- name (string, обяз.): полное название мода.
- description (string, обяз.): краткое описание.
- status (enum, обяз.): "Завершен" | "В процессе".
- release_date (string, обяз.): дата релиза в ISO-формате YYYY-MM-DD.
- original_author (string, обяз.): автор оригинала.
- image (string, опц.): абсолютная ссылка на картинку (предпочтительно HTTPS). Используется, если задана напрямую.
- image_id (string, опц.): ID файла Google Drive с обложкой; если указано, image формируется автоматически.
- drive_url (string, опц.): ссылка для скачивания/страницы; если не указана, и есть file_id, формируем автоматически.
- file_id (string, опц.): ID файла Google Drive для скачивания.
- source_url (string, опц.): ссылка на исходник/репозиторий/страницу мода.
- tags (array<string>, опц.): список тегов/жанров.
- size_mb (number, опц.): примерный размер файла.
- mirrors (array<string>, опц.): зеркала загрузки.
- warnings (array<string>, опц.): контент-предупреждения.
- notes (string, опц.): дополнительные заметки.

Правила формирования ссылок Google Drive:

- Превью картинки: <https://drive.google.com/uc?export=view&id={image_id}>
- Скачать файл: <https://drive.google.com/uc?export=download&id={file_id}>

Приоритет полей:

- Для изображения: image > image_id.
- Для скачивания: drive_url > file_id.