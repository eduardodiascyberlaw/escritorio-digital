import { loadUsers } from '../users.js';
const users = await loadUsers();
console.log('Utilizadores criados:');
users.forEach(u => console.log(`  ${u.username} (${u.displayName}) [${u.role}]`));
console.log('\nAlterem as passwords no primeiro acesso.');
