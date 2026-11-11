-- Weekly plan history: a workout now applies to a range of weeks instead of to every week, so changing
-- the plan changes this week and the weeks after it, while earlier weeks keep what they had.
--   valid_from  = the Sunday of the first week it applies to
--   valid_until = the Sunday of the last week it applies to; NULL = still repeating every week
ALTER TABLE workouts ADD COLUMN valid_from  TEXT;
ALTER TABLE workouts ADD COLUMN valid_until TEXT;

-- Existing workouts start in the week they were created (the Sunday on or before that day)...
UPDATE workouts
   SET valid_from = date(created_at, '-' || strftime('%w', created_at) || ' days');

-- ...but never later than a week they were ticked off in, so no completed workout disappears from its week.
UPDATE workouts
   SET valid_from = (SELECT MIN(l.week_start) FROM workout_logs l WHERE l.workout_id = workouts.id)
 WHERE EXISTS (SELECT 1 FROM workout_logs l WHERE l.workout_id = workouts.id AND l.week_start < workouts.valid_from);
