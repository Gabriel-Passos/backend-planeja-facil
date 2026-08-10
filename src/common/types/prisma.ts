// Único ponto de import pra tudo que vem do Prisma Client no projeto.
// Nunca importe diretamente de '@prisma/client' (pacote padrão, pode estar
// desatualizado) nem de '@/generated/prisma/client' espalhado pelo código —
// sempre a partir daqui, pra garantir que todo mundo usa o mesmo client
// gerado a partir do schema atual.
export * from '@/generated/prisma/client';
