// import "dotenv/config";
// import { defineConfig, env } from "prisma/config";

// export default defineConfig({
//   schema: "prisma/schema.prisma",
//   datasource: {
//     url: env("DIRECT_URL"), // <-- change from DATABASE_URL
//   },
// });
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

console.log(process.env.DATABASE_URL);

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});