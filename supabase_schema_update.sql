-- 1. TABLA DE ADMINISTRADORES (VINCULADA A AUTH)
DROP TABLE IF EXISTS admin_users;
CREATE TABLE admin_users (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE
);

-- 2. INSERTAR USUARIO ADMINISTRADOR REAL
INSERT INTO admin_users (id, email)
SELECT id, email FROM auth.users WHERE email = 'mdeviajob@gmail.com';

-- 3. FUNCIÓN PARA INCREMENTAR SELLOS (RPC)
CREATE OR REPLACE FUNCTION increment_stamps(client_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  current_stamps int;
  updated_row clientes%rowtype;
BEGIN
  SELECT stamps_count INTO current_stamps FROM clientes WHERE id = client_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  UPDATE clientes SET stamps_count = stamps_count + 1 WHERE id = client_id RETURNING * INTO updated_row;

  RETURN json_build_object(
    'success', true,
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;
