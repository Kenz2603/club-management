CREATE TABLE IF NOT EXISTS members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    club_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL,
    phone VARCHAR(20),
    student_code VARCHAR(50),
    joined_date DATE,
    role ENUM('member', 'leader', 'vice_leader') NOT NULL DEFAULT 'member',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_members_club
        FOREIGN KEY (club_id) REFERENCES clubs(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT uq_members_club_email UNIQUE (club_id, email),
    INDEX idx_members_club_status (club_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
