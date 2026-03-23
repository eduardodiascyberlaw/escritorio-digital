import { findUser, changePassword } from '../users.js';
const [,, username, newPassword] = process.argv;
if (!username || !newPassword) {
  console.error('Uso: tsx scripts/change-password.ts <username> <nova-password>');
  process.exit(1);
}
const user = await findUser(username);
if (!user) { console.error(`Utilizador "${username}" nao encontrado.`); process.exit(1); }
await changePassword(username, newPassword);
console.log(`Password de "${username}" alterada.`);
