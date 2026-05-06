import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type Assignment = {
  id: string;
  storeDomain: string;
  investorEmail: string;
  investorName: string;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantTitle?: string;
  createdAt: string;
};

export type Investor = {
  id: string;
  storeDomain: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type PublicInvestor = Omit<Investor, "passwordHash">;

export type InstalledStore = {
  storeDomain: string;
  storeId?: string;
  storeName?: string;
  accessToken: string;
  installedAt: string;
  updatedAt: string;
};

const dataDirectory = path.resolve(process.cwd(), "data");
const assignmentsPath = path.join(dataDirectory, "assignments.json");
const investorsPath = path.join(dataDirectory, "investors.json");
const installedStoresPath = path.join(dataDirectory, "installed-stores.json");
let assignmentWriteQueue = Promise.resolve();
let investorWriteQueue = Promise.resolve();
let installedStoreWriteQueue = Promise.resolve();

async function withAssignmentWriteLock<T>(operation: () => Promise<T>) {
  const nextOperation = assignmentWriteQueue.then(operation, operation);
  assignmentWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );

  return nextOperation;
}

async function withInvestorWriteLock<T>(operation: () => Promise<T>) {
  const nextOperation = investorWriteQueue.then(operation, operation);
  investorWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );

  return nextOperation;
}

async function withInstalledStoreWriteLock<T>(operation: () => Promise<T>) {
  const nextOperation = installedStoreWriteQueue.then(operation, operation);
  installedStoreWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );

  return nextOperation;
}

function normalizeStoreDomain(storeDomain: string) {
  return storeDomain.trim().toLowerCase();
}

async function readAssignments(): Promise<Assignment[]> {
  try {
    const content = await readFile(assignmentsPath, "utf8");
    return JSON.parse(content) as Assignment[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeAssignments(assignments: Assignment[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(assignmentsPath, JSON.stringify(assignments, null, 2), "utf8");
}

async function readInvestors(): Promise<Investor[]> {
  try {
    const content = await readFile(investorsPath, "utf8");
    return JSON.parse(content) as Investor[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeInvestors(investors: Investor[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(investorsPath, JSON.stringify(investors, null, 2), "utf8");
}

async function readInstalledStores(): Promise<InstalledStore[]> {
  try {
    const content = await readFile(installedStoresPath, "utf8");
    return JSON.parse(content) as InstalledStore[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeInstalledStores(installedStores: InstalledStore[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(
    installedStoresPath,
    JSON.stringify(installedStores, null, 2),
    "utf8",
  );
}

function publicInvestor(investor: Investor): PublicInvestor {
  const { passwordHash: _passwordHash, ...safeInvestor } = investor;
  return safeInvestor;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return (
    storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
  );
}

export async function installStore(input: {
  storeDomain: string;
  storeId?: string;
  storeName?: string;
  accessToken: string;
}) {
  return withInstalledStoreWriteLock(async () => {
    const installedStores = await readInstalledStores();
    const storeDomain = normalizeStoreDomain(input.storeDomain);
    const now = new Date().toISOString();
    const existingIndex = installedStores.findIndex(
      (store) => store.storeDomain === storeDomain,
    );
    const installedStore: InstalledStore = {
      storeDomain,
      storeId: input.storeId,
      storeName: input.storeName,
      accessToken: input.accessToken,
      installedAt:
        existingIndex >= 0 ? installedStores[existingIndex].installedAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      installedStores[existingIndex] = installedStore;
    } else {
      installedStores.push(installedStore);
    }

    await writeInstalledStores(installedStores);

    const { accessToken: _accessToken, ...safeStore } = installedStore;
    return safeStore;
  });
}

export async function getInstalledStore(storeDomain: string) {
  const normalizedStoreDomain = normalizeStoreDomain(storeDomain);
  const installedStores = await readInstalledStores();

  return (
    installedStores.find(
      (store) => store.storeDomain === normalizedStoreDomain,
    ) ?? null
  );
}

export async function listAssignments(storeDomain: string) {
  const normalizedStoreDomain = normalizeStoreDomain(storeDomain);
  const assignments = await readAssignments();

  return assignments
    .filter(
      (assignment) =>
        !assignment.storeDomain ||
        assignment.storeDomain === normalizedStoreDomain,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createAssignment(
  input: Omit<Assignment, "id" | "createdAt">,
) {
  return withAssignmentWriteLock(async () => {
    const assignments = await readAssignments();
    const storeDomain = normalizeStoreDomain(input.storeDomain);
    const duplicateAssignment = assignments.find(
      (assignment) =>
        (assignment.storeDomain || storeDomain) === storeDomain &&
        assignment.investorEmail.trim().toLowerCase() ===
          input.investorEmail.trim().toLowerCase() &&
        assignment.productId === input.productId &&
        (assignment.variantId ?? "") === (input.variantId ?? ""),
    );

    if (duplicateAssignment) {
      return duplicateAssignment;
    }

    const assignment: Assignment = {
      ...input,
      storeDomain,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    assignments.push(assignment);
    await writeAssignments(assignments);

    return assignment;
  });
}

export async function deleteAssignment(id: string) {
  return withAssignmentWriteLock(async () => {
    const assignments = await readAssignments();
    const nextAssignments = assignments.filter(
      (assignment) => assignment.id !== id,
    );

    if (nextAssignments.length === assignments.length) {
      return false;
    }

    await writeAssignments(nextAssignments);
    return true;
  });
}

export async function deleteAssignmentByIdentity(input: {
  storeDomain: string;
  investorEmail: string;
  productId: string;
  variantId?: string;
}) {
  return withAssignmentWriteLock(async () => {
    const assignments = await readAssignments();
    const storeDomain = normalizeStoreDomain(input.storeDomain);
    const normalizedEmail = input.investorEmail.trim().toLowerCase();
    const nextAssignments = assignments.filter((assignment) => {
      const sameStore = (assignment.storeDomain || storeDomain) === storeDomain;
      const sameInvestor =
        assignment.investorEmail.trim().toLowerCase() === normalizedEmail;
      const sameProduct = assignment.productId === input.productId;
      const sameVariant =
        (assignment.variantId ?? "") === (input.variantId ?? "");

      return !(sameStore && sameInvestor && sameProduct && sameVariant);
    });

    if (nextAssignments.length === assignments.length) {
      return false;
    }

    await writeAssignments(nextAssignments);
    return true;
  });
}

export async function deleteInvestor(storeDomain: string, email: string) {
  const normalizedStoreDomain = normalizeStoreDomain(storeDomain);
  const normalizedEmail = email.trim().toLowerCase();
  const deletedInvestor = await withInvestorWriteLock(async () => {
    const investors = await readInvestors();
    const nextInvestors = investors.filter(
      (investor) =>
        (investor.storeDomain || normalizedStoreDomain) !==
          normalizedStoreDomain ||
        investor.email.trim().toLowerCase() !== normalizedEmail,
    );
    const investorDeleted = nextInvestors.length !== investors.length;

    if (investorDeleted) {
      await writeInvestors(nextInvestors);
    }

    return investorDeleted;
  });

  const deletedAssignments = await withAssignmentWriteLock(async () => {
    const assignments = await readAssignments();
    const nextAssignments = assignments.filter(
      (assignment) =>
        (assignment.storeDomain || normalizedStoreDomain) !==
          normalizedStoreDomain ||
        assignment.investorEmail.trim().toLowerCase() !== normalizedEmail,
    );
    const deletedCount = assignments.length - nextAssignments.length;

    if (deletedCount) {
      await writeAssignments(nextAssignments);
    }

    return deletedCount;
  });

  return {
    deleted: deletedInvestor || deletedAssignments > 0,
    deletedInvestor,
    deletedAssignments,
  };
}

export async function listInvestors(storeDomain: string) {
  const normalizedStoreDomain = normalizeStoreDomain(storeDomain);
  const investors = await readInvestors();

  return investors
    .filter(
      (investor) =>
        !investor.storeDomain ||
        investor.storeDomain === normalizedStoreDomain,
    )
    .map(publicInvestor)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createInvestor(input: {
  storeDomain: string;
  name: string;
  email: string;
  password: string;
}) {
  return withInvestorWriteLock(async () => {
    const investors = await readInvestors();
    const storeDomain = normalizeStoreDomain(input.storeDomain);
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingInvestor = investors.find(
      (investor) =>
        (investor.storeDomain || storeDomain) === storeDomain &&
        investor.email.toLowerCase() === normalizedEmail,
    );

    if (existingInvestor) {
      throw new Error("Investor already exists");
    }

    const investor: Investor = {
      id: crypto.randomUUID(),
      storeDomain,
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };

    investors.push(investor);
    await writeInvestors(investors);

    return publicInvestor(investor);
  });
}

export async function authenticateInvestor(
  storeDomain: string,
  email: string,
  password: string,
) {
  const normalizedStoreDomain = normalizeStoreDomain(storeDomain);
  const normalizedEmail = email.trim().toLowerCase();
  const investors = await readInvestors();
  const investor = investors.find(
    (item) =>
      (item.storeDomain || normalizedStoreDomain) === normalizedStoreDomain &&
      item.email.toLowerCase() === normalizedEmail,
  );

  if (!investor || !(await verifyPassword(password, investor.passwordHash))) {
    return null;
  }

  return publicInvestor(investor);
}
