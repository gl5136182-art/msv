// Seed base: categorias aprovadas, UTs de prisma/seed/uts.csv e admin pelo .env (Fase 1, SPEC §6.0).
// Ainda vazio: o schema só ganha os models na Fase 1.
async function semear() {
  console.log("seed: nada a fazer ainda (implementado na Fase 1).");
}

semear().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
