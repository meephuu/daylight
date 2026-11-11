-- Picture notes: a note is either a text post-it or an image. The picture itself lives in its own
-- table so the board's note list stays light and each image is only read when it is shown.
ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));

CREATE TABLE note_images (
    note_id INTEGER PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
    data    TEXT    NOT NULL   -- the whole picture as a data URL, e.g. "data:image/webp;base64,..."
);
