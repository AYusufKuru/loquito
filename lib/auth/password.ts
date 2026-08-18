import bcrypt from "bcryptjs";

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Geçerli ama hiçbir hesaba ait olmayan hash — sabit maliyetli karşılaştırma için. */
const DUMMY_HASH = "$2b$10$6aSx2eFGgZuAUlOlJGYBg.edg8J2G1swbDFibwe7zy231DUdWbJju";

/**
 * Kullanıcı bulunamadığında da bcrypt maliyetini öder; böylece giriş
 * yanıt süresi hesabın varlığını ele vermez. Her zaman false döner.
 */
export async function verifyDummyPassword(plain: string): Promise<false> {
  await bcrypt.compare(plain, DUMMY_HASH);
  return false;
}
