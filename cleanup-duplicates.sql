-- Check duplicate phone numbers in call logs
SELECT phone_number, COUNT(*) as count 
FROM call_logs 
WHERE phone_number = '9415180701' OR phone_number LIKE '%941518%'
GROUP BY phone_number
ORDER BY count DESC;

-- Check message threads for duplicates
SELECT phone_number, COUNT(*) as count 
FROM message_threads 
WHERE phone_number = '9415180701' OR phone_number LIKE '%941518%'
GROUP BY phone_number
ORDER BY count DESC;

-- Show all 941-518-0701 related entries
SELECT * FROM call_logs WHERE phone_number LIKE '%941518%' ORDER BY timestamp DESC;
SELECT * FROM message_threads WHERE phone_number LIKE '%941518%' ORDER BY last_message_timestamp DESC;