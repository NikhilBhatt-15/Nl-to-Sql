from sql_generator import generate_sql
from sql_validator import validate
from database import run_raw_query

sql = generate_sql('Show me all customers')
print('Generated SQL:', sql)
result = validate(sql)
print('Validation result:', result.is_valid)
if result.is_valid:
    rows = run_raw_query(result.sql)
    print('Rows:', len(rows))
    print('First row:', rows[0] if rows else 'No rows')
else:
    print('Error:', result.error)