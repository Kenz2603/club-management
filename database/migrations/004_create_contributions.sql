CREATE TABLE IF NOT EXISTS contributions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    contribution_date DATE NOT NULL,
    payment_method ENUM('cash', 'bank_transfer', 'other')
        NOT NULL DEFAULT 'cash',
    status ENUM('pending', 'confirmed', 'cancelled')
        NOT NULL DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_contributions_member
        FOREIGN KEY (member_id) REFERENCES members(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_contributions_amount
        CHECK (amount > 0),
    INDEX idx_contributions_member_date (member_id, contribution_date),
    INDEX idx_contributions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
