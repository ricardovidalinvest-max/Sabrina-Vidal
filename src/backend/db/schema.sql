-- ==============================================================================
-- Schema SQL Puro (PostgreSQL) - Agendamento e Pagamento Automatizado Fail-Proof
-- ==============================================================================

-- 1. Habilitar extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Criar tipo ENUM para o status do agendamento
DO $$ BEGIN
    CREATE TYPE booking_status_enum AS ENUM ('PENDING', 'PAID', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Criar Tabela 'agendamentos'
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calcom_booking_id VARCHAR(255) NOT NULL UNIQUE,
    asaas_payment_id VARCHAR(255) UNIQUE,
    status booking_status_enum NOT NULL DEFAULT 'PENDING',
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Índices para performance e busca rápida
-- Índice para busca imediata do Webhook do Asaas por payment_id
CREATE INDEX IF NOT EXISTS idx_agendamentos_asaas_payment 
ON agendamentos(asaas_payment_id);

-- Índice composto para a rotina de limpeza rápida do Cron (status + created_at)
CREATE INDEX IF NOT EXISTS idx_agendamentos_cleanup 
ON agendamentos(status, created_at) 
WHERE status = 'PENDING';

-- 5. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_agendamentos_updated_at ON agendamentos;
CREATE TRIGGER trigger_agendamentos_updated_at
    BEFORE UPDATE ON agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
