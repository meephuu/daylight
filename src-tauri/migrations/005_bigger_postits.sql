-- Post-its are a bit bigger by default (224x208 -> 280x260). Grow the ones that were never resized;
-- notes the user resized themselves keep their size.
UPDATE notes SET width = 280, height = 260 WHERE width = 224 AND height = 208;
