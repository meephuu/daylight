-- Weeks now run Sunday to Saturday everywhere. Weekday numbers change from
-- 0 = Monday ... 6 = Sunday to 0 = Sunday ... 6 = Saturday, so stored values shift by one.

-- Training plan: day of the week of each workout.
UPDATE workouts SET day_of_week = (day_of_week + 1) % 7;

-- Weekly repeating events/reminders: "0,2,4" (Mon, Wed, Fri) becomes "1,3,5". Digits are swapped through
-- a placeholder so each one moves exactly once: 6->x, 5->6, 4->5, 3->4, 2->3, 1->2, 0->1, x->0.
UPDATE calendar_items
   SET repeat_weekdays = replace(replace(replace(replace(replace(replace(replace(replace(
         repeat_weekdays, '6', 'x'), '5', '6'), '4', '5'), '3', '4'), '2', '3'), '1', '2'), '0', '1'), 'x', '0')
 WHERE repeat_weekdays <> '';

-- Training completions are filed under the week they belong to; recompute it as the Sunday on or
-- before the day it was ticked off. Rows that would collide are left and removed just below.
UPDATE OR IGNORE workout_logs
   SET week_start = date(done_date, '-' || strftime('%w', done_date) || ' days');
DELETE FROM workout_logs WHERE strftime('%w', week_start) <> '0';
