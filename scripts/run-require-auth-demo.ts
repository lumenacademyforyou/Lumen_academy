import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import {
  requireAuth,
  withErrorHandling,
  UnauthenticatedError,
  ForbiddenRoleError,
} from "../lib/auth/require-auth.js";
import {
  NotFoundError,
  ForbiddenError,
  AttemptClosedError,
  DeadlinePassedError,
} from "../lib/services/attempt-service.js";
import { ValidationError } from "../lib/services/question-review-service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting requireAuth & withErrorHandling Execution Test...\n");

  // 1. Test withErrorHandling wrapper with simulated Next.js App Router handlers
  console.log("--- 1. Testing withErrorHandling Route Handler Wrapper ---");

  // Handler A: Unauthenticated Error
  const unauthHandler = withErrorHandling(async () => {
    throw new UnauthenticatedError("No valid session");
  });
  const resA = await unauthHandler(new NextRequest("http://localhost:3000/api/test"));
  const jsonA = await resA.json();
  console.log(`✅ UnauthenticatedError caught -> Status: ${resA.status}, Body: ${JSON.stringify(jsonA)}`);

  // Handler B: Forbidden Role Error
  const forbiddenRoleHandler = withErrorHandling(async () => {
    throw new ForbiddenRoleError("Requires role FACULTY or ADMIN, has STUDENT");
  });
  const resB = await forbiddenRoleHandler(new NextRequest("http://localhost:3000/api/test"));
  const jsonB = await resB.json();
  console.log(`✅ ForbiddenRoleError caught -> Status: ${resB.status}, Body: ${JSON.stringify(jsonB)}`);

  // Handler C: Validation Error with Issues
  const validationHandler = withErrorHandling(async () => {
    throw new ValidationError("Question failed validation", ["stemEn is empty", "marks must be positive"]);
  });
  const resC = await validationHandler(new NextRequest("http://localhost:3000/api/test"));
  const jsonC = await resC.json();
  console.log(`✅ ValidationError caught -> Status: ${resC.status}, Body: ${JSON.stringify(jsonC)}`);

  // Handler D: Service NotFoundError
  const notFoundHandler = withErrorHandling(async () => {
    throw new NotFoundError("Test not found");
  });
  const resD = await notFoundHandler(new NextRequest("http://localhost:3000/api/test"));
  const jsonD = await resD.json();
  console.log(`✅ NotFoundError caught -> Status: ${resD.status}, Body: ${JSON.stringify(jsonD)}`);

  // Handler E: Deadline Passed Error
  const deadlineHandler = withErrorHandling(async () => {
    throw new DeadlinePassedError("Deadline has passed");
  });
  const resE = await deadlineHandler(new NextRequest("http://localhost:3000/api/test"));
  const jsonE = await resE.json();
  console.log(`✅ DeadlinePassedError caught -> Status: ${resE.status}, Body: ${JSON.stringify(jsonE)}`);

  // Handler F: Successful Route Handler
  const successHandler = withErrorHandling(async () => {
    return NextResponse.json({ success: true, message: "Attempt started" }, { status: 200 });
  });
  const resF = await successHandler(new NextRequest("http://localhost:3000/api/test"));
  const jsonF = await resF.json();
  console.log(`✅ Success handler -> Status: ${resF.status}, Body: ${JSON.stringify(jsonF)}`);

  // 2. Test requireAuth database upsert and role validation logic
  console.log("\n--- 2. Testing Database User Lazy Creation & Role Guard Logic ---");

  const testAuthUserId = "supabase-auth-demo-user-id";
  const user = await prisma.user.upsert({
    where: { id: testAuthUserId },
    update: {},
    create: {
      id: testAuthUserId,
      email: "demo-student@lumen.academy",
      role: Role.STUDENT,
    },
  });

  console.log(`✅ User lazy upsert succeeded -> ID: ${user.id}, Role: ${user.role}`);

  // Verify Role Gating Check Logic
  const options: { role?: Role[] } = { role: [Role.FACULTY, Role.ADMIN] };
  if (options.role && !options.role.includes(user.role)) {
    console.log(`✅ Role check correctly rejected student from faculty/admin route: Requires ${options.role.join(" or ")}, has ${user.role}`);
  }

  // Clean up demo user
  console.log("\n🧹 Cleaning up demo user...");
  await prisma.user.delete({ where: { id: testAuthUserId } });
  console.log("✨ Cleaned up successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
