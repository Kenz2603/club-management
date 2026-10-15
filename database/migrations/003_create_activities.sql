CREATE TABLE IF NOT EXISTS activities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    club_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    max_participants INT UNSIGNED,
    status ENUM('planned', 'ongoing', 'completed', 'cancelled')
        NOT NULL DEFAULT 'planned',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_activities_club
        FOREIGN KEY (club_id) REFERENCES clubs(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_activities_time
        CHECK (end_time > start_time),
    INDEX idx_activities_club_start (club_id, start_time),
    INDEX idx_activities_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
