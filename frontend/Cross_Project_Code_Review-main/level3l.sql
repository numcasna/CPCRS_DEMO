-- CROSS-PROJECT CODE REVIEW FINDING TRACKER
-- PostgreSQL Database Schema + Level 3 Data
-- Database: code_review_tracker

-- =========================================================
-- LEVEL 1: DATABASE STRUCTURE
-- =========================================================

-- USERS
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PROJECTS
CREATE TABLE projects (
    project_id SERIAL PRIMARY KEY,
    project_name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REPOSITORIES
CREATE TABLE repositories (
    repository_id SERIAL PRIMARY KEY,
    repository_name VARCHAR(150) NOT NULL,
    repository_url TEXT,
    project_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id)
        REFERENCES projects(project_id)
);

-- FINDINGS
CREATE TABLE findings (
    finding_id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    repository_id INTEGER NOT NULL,
    reported_by INTEGER NOT NULL,
    assigned_to INTEGER,
    file_path TEXT,
    line_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id)
        REFERENCES repositories(repository_id),
    FOREIGN KEY (reported_by)
        REFERENCES users(user_id),
    FOREIGN KEY (assigned_to)
        REFERENCES users(user_id)
);

-- =========================================================
-- LEVEL 2: CONSTRAINTS AND SUPPORTING TABLES
-- =========================================================

ALTER TABLE findings
ADD CONSTRAINT findings_severity_check
CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));

ALTER TABLE findings
ADD CONSTRAINT findings_status_check
CHECK (
    status IN (
        'OPEN',
        'IN_PROGRESS',
        'RESOLVED',
        'CLOSED',
        'REJECTED'
    )
);

ALTER TABLE findings
ADD CONSTRAINT findings_title_check
CHECK (LENGTH(TRIM(title)) > 0);

ALTER TABLE findings
ADD CONSTRAINT findings_line_number_check
CHECK (line_number IS NULL OR line_number > 0);

ALTER TABLE findings
ADD COLUMN finding_type VARCHAR(30);

ALTER TABLE findings
ADD CONSTRAINT findings_type_check
CHECK (
    finding_type IN (
        'SECURITY',
        'BUG',
        'PERFORMANCE',
        'CODE_QUALITY',
        'STYLE',
        'DOCUMENTATION'
    )
);

ALTER TABLE findings
ADD COLUMN priority VARCHAR(20);

ALTER TABLE findings
ADD CONSTRAINT findings_priority_check
CHECK (
    priority IN (
        'URGENT',
        'HIGH',
        'MEDIUM',
        'LOW'
    )
);

-- COMMENTS
CREATE TABLE finding_comments (
    comment_id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id)
        REFERENCES findings(finding_id),
    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);

-- STATUS HISTORY
CREATE TABLE finding_status_history (
    history_id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by INTEGER NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id)
        REFERENCES findings(finding_id),
    FOREIGN KEY (changed_by)
        REFERENCES users(user_id)
);

-- TAGS
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FINDING-TAG MANY-TO-MANY RELATIONSHIP
CREATE TABLE finding_tags (
    finding_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (finding_id, tag_id),
    FOREIGN KEY (finding_id)
        REFERENCES findings(finding_id),
    FOREIGN KEY (tag_id)
        REFERENCES tags(tag_id)
);

-- ATTACHMENTS
CREATE TABLE finding_attachments (
    attachment_id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (finding_id)
        REFERENCES findings(finding_id),
    FOREIGN KEY (uploaded_by)
        REFERENCES users(user_id)
);

-- REJECTION REASON
ALTER TABLE findings
ADD COLUMN rejection_reason TEXT;


-- =========================================================
-- LEVEL 3: SAMPLE DATA / INPUT
-- =========================================================

-- USERS
INSERT INTO users (name, email, role)
VALUES
('Yash Tanwar', 'yash@example.com', 'ADMIN'),
('Rahul Sharma', 'rahul@example.com', 'CODE_REVIEWER'),
('Amit Kumar', 'amit@example.com', 'DEVELOPER'),
('Priya Singh', 'priya@example.com', 'PROJECT_LEAD'),
('Neha Verma', 'neha@example.com', 'READ_ONLY');

-- PROJECTS
INSERT INTO projects (project_name, description)
VALUES
('Banking Application', 'Secure banking application'),
('E-Commerce Platform', 'Online shopping platform'),
('HR Management System', 'Employee and HR management system');

-- REPOSITORIES
INSERT INTO repositories
(repository_name, repository_url, project_id)
VALUES
('banking-backend', 'https://gitlab.example.com/banking-backend', 1),
('banking-frontend', 'https://gitlab.example.com/banking-frontend', 1),
('ecommerce-api', 'https://gitlab.example.com/ecommerce-api', 2),
('ecommerce-web', 'https://gitlab.example.com/ecommerce-web', 2),
('hr-management', 'https://gitlab.example.com/hr-management', 3);

-- TAGS
INSERT INTO tags (tag_name)
VALUES
('security'),
('backend'),
('frontend'),
('performance'),
('bug'),
('code-quality');

-- FINDINGS
INSERT INTO findings
(
    title,
    description,
    severity,
    status,
    repository_id,
    reported_by,
    assigned_to,
    file_path,
    line_number,
    finding_type,
    priority
)
VALUES
(
    'SQL Injection Vulnerability',
    'User input is directly used in an SQL query without proper parameterization.',
    'CRITICAL',
    'OPEN',
    1,
    2,
    3,
    'src/auth/login.py',
    45,
    'SECURITY',
    'URGENT'
),
(
    'Slow Database Query',
    'The query performs a full table scan and causes high response time.',
    'HIGH',
    'IN_PROGRESS',
    1,
    2,
    3,
    'src/services/user_service.py',
    87,
    'PERFORMANCE',
    'HIGH'
),
(
    'Missing Input Validation',
    'API endpoint accepts invalid user input without proper validation.',
    'MEDIUM',
    'OPEN',
    3,
    2,
    3,
    'src/api/orders.py',
    32,
    'BUG',
    'MEDIUM'
),
(
    'Duplicate Code Block',
    'The same business logic is repeated in multiple functions.',
    'LOW',
    'RESOLVED',
    4,
    2,
    3,
    'src/components/Checkout.tsx',
    120,
    'CODE_QUALITY',
    'LOW'
),
(
    'Missing API Documentation',
    'The endpoint does not contain sufficient documentation for its request and response format.',
    'LOW',
    'OPEN',
    5,
    4,
    3,
    'src/api/employees.py',
    18,
    'DOCUMENTATION',
    'LOW'
);


-- =========================================================
-- LEVEL 3: SQL OPERATIONS PRACTICED
-- =========================================================

-- SELECT ALL FINDINGS
SELECT *
FROM findings;

-- SELECT SPECIFIC COLUMNS
SELECT
    finding_id,
    title,
    severity,
    status,
    priority
FROM findings;

-- WHERE / FILTERING
SELECT
    finding_id,
    title,
    severity,
    status,
    priority
FROM findings
WHERE severity = 'CRITICAL';

-- ORDER BY
SELECT finding_id, title, severity, priority
FROM findings
ORDER BY finding_id DESC;

-- UPDATE
-- Example used during practice:
-- UPDATE findings
-- SET status = 'RESOLVED'
-- WHERE finding_id = 1;

-- DELETE
-- Example syntax only; not intended to be run on the real dataset:
-- DELETE FROM findings
-- WHERE finding_id = 1;

-- JOIN: FINDING + REPOSITORY + ASSIGNED USER
SELECT
    f.finding_id,
    f.title,
    r.repository_name,
    u.name AS assigned_to,
    f.severity,
    f.status
FROM findings f
JOIN repositories r
    ON f.repository_id = r.repository_id
JOIN users u
    ON f.assigned_to = u.user_id;

-- COUNT TOTAL FINDINGS
SELECT COUNT(*) AS total_findings
FROM findings;

-- COUNT FINDINGS BY SEVERITY
SELECT
    severity,
    COUNT(*) AS total
FROM findings
GROUP BY severity;

-- PROJECT + REPOSITORY + FINDING
SELECT
    p.project_name,
    r.repository_name,
    f.title,
    f.severity,
    f.status
FROM projects p
JOIN repositories r
    ON p.project_id = r.project_id
JOIN findings f
    ON r.repository_id = f.repository_id
ORDER BY p.project_name;
