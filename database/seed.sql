-- Sample e-commerce schema with enough relational complexity to make
-- NL-to-SQL demos non-trivial (joins, aggregations, date filtering)

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    signup_date DATE NOT NULL,
    country TEXT NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled'))
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL
);

-- Sample data
INSERT INTO customers (name, email, signup_date, country) VALUES
('Asha Rao', 'asha@example.com', '2025-01-15', 'India'),
('Liam Chen', 'liam@example.com', '2025-02-20', 'USA'),
('Priya Sharma', 'priya@example.com', '2025-03-05', 'India'),
('Tom Becker', 'tom@example.com', '2025-04-10', 'Germany'),
('Mei Tanaka', 'mei@example.com', '2025-05-18', 'Japan');

INSERT INTO products (name, category, price) VALUES
('Wireless Mouse', 'Electronics', 25.99),
('Mechanical Keyboard', 'Electronics', 89.99),
('Standing Desk', 'Furniture', 349.00),
('Desk Lamp', 'Furniture', 45.50),
('Noise-Cancelling Headphones', 'Electronics', 199.00);

INSERT INTO orders (customer_id, order_date, status) VALUES
(1, '2025-06-01', 'delivered'),
(1, '2025-07-15', 'delivered'),
(2, '2025-06-10', 'shipped'),
(3, '2025-06-20', 'delivered'),
(3, '2025-07-01', 'cancelled'),
(4, '2025-07-05', 'delivered'),
(5, '2025-07-20', 'pending');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 2, 25.99),
(1, 4, 1, 45.50),
(2, 3, 1, 349.00),
(3, 2, 1, 89.99),
(4, 5, 1, 199.00),
(4, 1, 1, 25.99),
(5, 3, 1, 349.00),
(6, 2, 2, 89.99),
(7, 5, 1, 199.00);

-- Example questions this schema supports:
--   "Which customers placed orders over $500 total?"
--   "What's the best-selling product category?"
--   "How many orders were cancelled?"
--   "Which country has the most customers?"
