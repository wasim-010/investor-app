import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Modal,
  Text,
} from "@soppiya/elementus";
import {
  Boxes,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.PUBLIC_APP_API_URL ??
  import.meta.env.PUBLIC_DUAZON_API_URL ??
  "http://127.0.0.1:4000";
const MERCHANT_API_KEY = import.meta.env.PUBLIC_MERCHANT_API_KEY ?? "";

type Overview = {
  assignedProducts: number;
  activeInvestors: number;
  trackedOrders: number;
  grossSales: number;
  soldQuantity: number;
};

type Assignment = {
  id: string;
  investorEmail: string;
  investorName: string;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantTitle?: string;
  sales?: {
    trackedOrders: number;
    grossSales: number;
    soldQuantity: number;
  };
  createdAt: string;
};

type Investor = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type SoppiyaProduct = {
  _id: string;
  title: string;
  status: string;
  vendor?: string | null;
  type?: string | null;
  variants: {
    edges: Array<{
      node: {
        _id: string;
        option1?: string | null;
        option2?: string | null;
        option3?: string | null;
      };
    }>;
  };
};

type ProductsResponse = {
  totalCount: number;
  edges: Array<{ node: SoppiyaProduct }>;
};

type AssignmentInput = Omit<Assignment, "id" | "createdAt" | "sales">;

type InvestorRow = {
  name: string;
  email: string;
  productIds: Set<string>;
  products: number;
  status: "Active";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);

const variantTitle = (
  variant?: SoppiyaProduct["variants"]["edges"][number]["node"],
) => {
  if (!variant) {
    return "";
  }

  return (
    [variant.option1, variant.option2, variant.option3]
      .filter(Boolean)
      .join(" / ") || "Default"
  );
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(MERCHANT_API_KEY ? { "x-merchant-api-key": MERCHANT_API_KEY } : {}),
      ...init?.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : null;
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Expected JSON from ${url}, received ${contentType || "unknown"}: ${text.slice(
        0,
        80,
      )}`,
    );
  }

  return response.json() as Promise<T>;
}

function App() {
  const [overview, setOverview] = useState<Overview>({
    assignedProducts: 0,
    activeInvestors: 0,
    trackedOrders: 0,
    grossSales: 0,
    soldQuantity: 0,
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [products, setProducts] = useState<SoppiyaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [deletingInvestor, setDeletingInvestor] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [investorModalOpen, setInvestorModalOpen] = useState(false);
  const [deleteInvestorModalOpen, setDeleteInvestorModalOpen] = useState(false);
  const [pendingDeleteInvestor, setPendingDeleteInvestor] =
    useState<InvestorRow | null>(null);
  const [productsError, setProductsError] = useState("");
  const [notice, setNotice] = useState("");
  const [newInvestorName, setNewInvestorName] = useState("");
  const [newInvestorEmail, setNewInvestorEmail] = useState("");
  const [newInvestorPassword, setNewInvestorPassword] = useState("");
  const [selectedInvestorEmail, setSelectedInvestorEmail] = useState("");
  const [selectedInvestorName, setSelectedInvestorName] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<
    Record<string, string[]>
  >({});

  const loadDashboard = async () => {
    setLoading(true);
    setNotice("");
    setProductsError("");

    try {
      const [overviewData, assignmentsData, investorsData] = await Promise.all([
        apiRequest<Overview>("/api/merchant/overview"),
        apiRequest<{ assignments: Assignment[] }>("/api/assignments"),
        apiRequest<{ investors: Investor[] }>("/api/investors"),
      ]);

      setOverview(overviewData);
      setAssignments(assignmentsData.assignments);
      setInvestors(investorsData.investors);
      setSelectedInvestorEmail(
        (current) => current || investorsData.investors[0]?.email || "",
      );

      try {
        const productData = await apiRequest<ProductsResponse>(
          "/api/soppiya/products?first=100",
        );
        const loadedProducts = productData.edges.map((edge) => edge.node);
        setProducts(loadedProducts);
        setSelectedProductIds((current) =>
          current.filter((productId) =>
            loadedProducts.some((product) => product._id === productId),
          ),
        );
      } catch (error) {
        setProducts([]);
        setProductsError(
          error instanceof Error ? error.message : "Products unavailable",
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Dashboard unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const investorRows = useMemo(() => {
    const investorMap = new Map<string, InvestorRow>();

    for (const investor of investors) {
      investorMap.set(investor.email, {
        name: investor.name,
        email: investor.email,
        productIds: new Set(),
        products: 0,
        status: "Active",
      });
    }

    for (const assignment of assignments) {
      const current = investorMap.get(assignment.investorEmail);

      investorMap.set(assignment.investorEmail, {
        name: assignment.investorName,
        email: assignment.investorEmail,
        productIds: new Set([
          ...(current?.productIds ?? []),
          assignment.productId,
        ]),
        products: 0,
        status: "Active",
      });
    }

    return Array.from(investorMap.values()).map((investor) => ({
      ...investor,
      products: investor.productIds.size,
    }));
  }, [assignments, investors]);

  const currentSelectedInvestor = useMemo(
    () => {
      const investor = investors.find(
        (item) => item.email === selectedInvestorEmail,
      );

      if (investor) {
        return investor;
      }

      if (!selectedInvestorEmail) {
        return null;
      }

      return {
        id: "",
        name: selectedInvestorName || selectedInvestorEmail,
        email: selectedInvestorEmail,
        createdAt: "",
      };
    },
    [investors, selectedInvestorEmail, selectedInvestorName],
  );

  const metrics = [
    {
      label: "Assigned products",
      value: String(overview.assignedProducts),
      detail: `${assignments.length} saved assignments`,
      icon: PackageCheck,
    },
    {
      label: "Tracked orders",
      value: String(overview.trackedOrders),
      detail: "Orders containing assigned products",
      icon: Boxes,
    },
    {
      label: "Gross sales",
      value: formatCurrency(overview.grossSales),
      detail: `${overview.soldQuantity} units sold`,
      icon: CircleDollarSign,
    },
    {
      label: "Active investors",
      value: String(overview.activeInvestors),
      detail: "Unique assigned emails",
      icon: Users,
    },
  ];

  const assignmentKey = (assignment: {
    productId: string;
    variantId?: string;
  }) => `${assignment.productId}:${assignment.variantId ?? ""}`;

  const buildAssignmentInputs = (
    investor: Investor,
    productIds: string[],
    variantByProduct: Record<string, string[]>,
  ): AssignmentInput[] => {
    const selectedProducts = productIds
      .map((productId) => products.find((product) => product._id === productId))
      .filter((product): product is SoppiyaProduct => Boolean(product));

    return selectedProducts.flatMap((product) => {
      const variantIds = variantByProduct[product._id] ?? [];
      const variants = product.variants.edges.map((edge) => edge.node);
      const selectedVariants = variantIds
        .map((variantId) => variants.find((variant) => variant._id === variantId))
        .filter((variant): variant is (typeof variants)[number] =>
          Boolean(variant),
        );

      if (!selectedVariants.length) {
        return [
          {
            investorEmail: investor.email,
            investorName: investor.name,
            productId: product._id,
            productTitle: product.title,
          },
        ];
      }

      return selectedVariants.map((variant) => ({
        investorEmail: investor.email,
        investorName: investor.name,
        productId: product._id,
        productTitle: product.title,
        variantId: variant._id,
        variantTitle: variantTitle(variant),
      }));
    });
  };

  const openAssignmentModalForInvestor = (investor: {
    name: string;
    email: string;
  }) => {
    const investorAssignments = assignments.filter(
      (assignment) =>
        assignment.investorEmail.toLowerCase() === investor.email.toLowerCase(),
    );
    const productIds = Array.from(
      new Set(investorAssignments.map((assignment) => assignment.productId)),
    );
    const variantByProduct = investorAssignments.reduce<Record<string, string[]>>(
      (current, assignment) => {
        if (!assignment.variantId) {
          return current;
        }

        return {
          ...current,
          [assignment.productId]: Array.from(
            new Set([
              ...(current[assignment.productId] ?? []),
              assignment.variantId,
            ]),
          ),
        };
      },
      {},
    );

    setSelectedInvestorEmail(investor.email);
    setSelectedInvestorName(investor.name);
    setSelectedProductIds(productIds);
    setSelectedVariantByProduct(variantByProduct);
    setAssignmentModalOpen(true);
  };

  const deleteAssignmentRequest = async (assignment: Assignment) => {
    const response = await fetch(
      `${API_BASE_URL}/api/assignments/${encodeURIComponent(assignment.id)}`,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          ...(MERCHANT_API_KEY ? { "x-merchant-api-key": MERCHANT_API_KEY } : {}),
        },
        body: JSON.stringify({
          investorEmail: assignment.investorEmail,
          productId: assignment.productId,
          variantId: assignment.variantId,
        }),
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Unassign failed with ${response.status}`);
    }
  };

  const saveProductAssignments = async () => {
    setNotice("");

    if (!currentSelectedInvestor) {
      setNotice("Select an investor before editing assignments.");
      return;
    }

    setAssigning(true);

    try {
      const assignmentInputs = buildAssignmentInputs(
        currentSelectedInvestor,
        selectedProductIds,
        selectedVariantByProduct,
      );
      const investorAssignments = assignments.filter(
        (assignment) =>
          assignment.investorEmail.toLowerCase() ===
          currentSelectedInvestor.email.toLowerCase(),
      );
      const desiredKeys = new Set(assignmentInputs.map(assignmentKey));
      const existingKeys = new Set(investorAssignments.map(assignmentKey));
      const keptExistingKeys = new Set<string>();
      const newAssignmentInputs = assignmentInputs.filter(
        (assignmentInput) => !existingKeys.has(assignmentKey(assignmentInput)),
      );
      const assignmentsToDelete = investorAssignments.filter((assignment) => {
        const key = assignmentKey(assignment);

        if (!desiredKeys.has(key)) {
          return true;
        }

        if (keptExistingKeys.has(key)) {
          return true;
        }

        keptExistingKeys.add(key);
        return false;
      });

      for (const assignment of assignmentsToDelete) {
        await deleteAssignmentRequest(assignment);
      }

      for (const assignmentInput of newAssignmentInputs) {
        await apiRequest<{ assignment: Assignment }>("/api/assignments", {
          method: "POST",
          body: JSON.stringify(assignmentInput),
        });
      }

      setNotice(
        `Updated ${currentSelectedInvestor.name}: ${newAssignmentInputs.length} added, ${assignmentsToDelete.length} removed.`,
      );
      setAssignmentModalOpen(false);
      await loadDashboard();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Assignment update failed");
    } finally {
      setAssigning(false);
    }
  };

  const createNewInvestor = async () => {
    setNotice("");

    try {
      await apiRequest<{ investor: Investor }>("/api/investors", {
        method: "POST",
        body: JSON.stringify({
          name: newInvestorName.trim(),
          email: newInvestorEmail.trim(),
          password: newInvestorPassword,
        }),
      });

      setNotice(`Investor added: ${newInvestorName.trim()}`);
      setSelectedInvestorEmail(newInvestorEmail.trim().toLowerCase());
      setNewInvestorName("");
      setNewInvestorEmail("");
      setNewInvestorPassword("");
      await loadDashboard();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Investor create failed");
    }
  };

  const openDeleteInvestorModal = (investor: InvestorRow) => {
    setPendingDeleteInvestor(investor);
    setDeleteInvestorModalOpen(true);
  };

  const closeDeleteInvestorModal = () => {
    if (deletingInvestor) {
      return;
    }

    setDeleteInvestorModalOpen(false);
    setPendingDeleteInvestor(null);
  };

  const deleteInvestorFromDashboard = async () => {
    setNotice("");

    if (!pendingDeleteInvestor) {
      return;
    }

    setDeletingInvestor(true);

    try {
      const result = await apiRequest<{
        deletedAssignments: number;
      }>(`/api/investors/${encodeURIComponent(pendingDeleteInvestor.email)}`, {
        method: "DELETE",
      });

      setNotice(
        `Deleted ${pendingDeleteInvestor.name} and removed ${result.deletedAssignments} assignment${
          result.deletedAssignments === 1 ? "" : "s"
        }.`,
      );
      setDeleteInvestorModalOpen(false);
      setPendingDeleteInvestor(null);
      await loadDashboard();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Investor delete failed");
    } finally {
      setDeletingInvestor(false);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Investor app navigation">
        <div className="brand-mark">I</div>
        <nav className="nav-list">
          <button className="nav-item active" type="button">
            Overview
          </button>
          <button className="nav-item" type="button">
            Investors
          </button>
          <button className="nav-item" type="button">
            Products
          </button>
          <button className="nav-item" type="button">
            Assignments
          </button>
          <button className="nav-item" type="button">
            Settings
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="page-header">
          <BlockStack gap={10}>
            <Text as="h1" size="lg" weight="bold">
              Soppiya investor app
            </Text>
            <Text as="p" size="sm" color="secondary">
              Assign store products to investors and track their product
              performance from one merchant dashboard.
            </Text>
          </BlockStack>

          <InlineStack gap={10} alignItems="center">
            <Button
              variant="outline"
              icon={<RefreshCw size={16} />}
              onClick={() => void loadDashboard()}
            >
              Sync
            </Button>
          </InlineStack>
        </header>

        {(notice || productsError) && (
          <div className="notice">
            {notice || `Soppiya products: ${productsError}`}
          </div>
        )}

        <section className="metric-grid" aria-label="Overview metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.label} padding={60} radius={8} shadow="xs">
                <InlineStack justifyContent="space-between" alignItems="start">
                  <BlockStack gap={10}>
                    <Text as="p" size="xs" color="secondary" weight="medium">
                      {metric.label}
                    </Text>
                    <Text as="h2" size="lg" weight="bold">
                      {loading ? "..." : metric.value}
                    </Text>
                    <Text as="p" size="xs" color="secondary">
                      {metric.detail}
                    </Text>
                  </BlockStack>
                  <span className="metric-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                </InlineStack>
              </Card>
            );
          })}
        </section>

        <section className="content-grid">
          <Card padding={60} radius={8} shadow="xs">
            <InlineStack justifyContent="space-between" alignItems="center">
              <BlockStack gap={10}>
                <Text as="h2" size="md" weight="bold">
                  Investors
                </Text>
                <Text as="p" size="xs" color="secondary">
                  Investors are calculated from saved product assignments.
                </Text>
              </BlockStack>
              <Button
                size="sm"
                variant="outline"
                icon={<Users size={14} />}
                onClick={() => setInvestorModalOpen(true)}
              >
                Manage
              </Button>
            </InlineStack>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th>Products</th>
                    <th>Sales</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {investorRows.map((investor) => (
                    <tr key={investor.email}>
                      <td>
                        <strong>{investor.name}</strong>
                        <span>{investor.email}</span>
                      </td>
                      <td>{investor.products}</td>
                      <td>
                        {formatCurrency(
                          assignments
                            .filter(
                              (assignment) =>
                                assignment.investorEmail === investor.email,
                            )
                            .reduce(
                              (total, assignment) =>
                                total + (assignment.sales?.grossSales ?? 0),
                              0,
                            ),
                        )}
                      </td>
                      <td>
                        <Badge variant="success">{investor.status}</Badge>
                      </td>
                      <td>
                        <InlineStack gap={8} alignItems="center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignmentModalForInvestor(investor)}
                          >
                            Assign product
                          </Button>
                          <Button
                            aria-label={`Delete ${investor.name}`}
                            className="icon-action"
                            color="danger"
                            icon={<Trash2 size={15} />}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => openDeleteInvestorModal(investor)}
                          />
                        </InlineStack>
                      </td>
                    </tr>
                  ))}
                  {!investorRows.length && (
                    <tr>
                      <td colSpan={5}>
                        <span>No investors assigned yet.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding={60} radius={8} shadow="xs">
            <InlineStack justifyContent="space-between" alignItems="center">
              <BlockStack gap={10}>
                <Text as="h2" size="md" weight="bold">
                  Product assignments
                </Text>
              <Text as="p" size="xs" color="secondary">
                Saved in the API for now; database persistence is next.
              </Text>
            </BlockStack>
            </InlineStack>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Investor</th>
                    <th>Sold</th>
                    <th>Sales</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>
                        <strong>{assignment.productTitle}</strong>
                        <span>{assignment.productId}</span>
                      </td>
                      <td>
                        {assignment.variantTitle ??
                          assignment.variantId ??
                          "All variants"}
                      </td>
                      <td>{assignment.investorName}</td>
                      <td>{assignment.sales?.soldQuantity ?? 0}</td>
                      <td>{formatCurrency(assignment.sales?.grossSales ?? 0)}</td>
                      <td>
                        {new Date(assignment.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {!assignments.length && (
                    <tr>
                      <td colSpan={6}>
                        <span>
                          No assignments yet. Use an investor row to assign products.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </section>

      <Modal
        open={assignmentModalOpen}
        title={`Assign products${currentSelectedInvestor ? ` to ${currentSelectedInvestor.name}` : ""}`}
        size="lg"
        onClose={() => setAssignmentModalOpen(false)}
        primaryAction={{
          content: "Done",
          loading: assigning,
          disabled:
            !products.length ||
            !currentSelectedInvestor ||
            assigning,
          onAction: saveProductAssignments,
        }}
        secondaryAction={{
          content: "Cancel",
          variation: "outline",
          onAction: () => setAssignmentModalOpen(false),
        }}
      >
        <BlockStack gap={20}>
          <InlineStack justifyContent="space-between" alignItems="center">
            <Text as="p" size="sm" color="secondary">
              Check products or variants to assign them. Uncheck and click Done to unassign.
            </Text>
            <Badge variant={selectedProductIds.length ? "success" : "warning"}>
              {selectedProductIds.length
                ? `${selectedProductIds.length} product${
                    selectedProductIds.length === 1 ? "" : "s"
                  } selected`
                : "No products selected"}
            </Badge>
          </InlineStack>

          <div className="product-pick-list">
            {products.map((product) => {
              const variants = product.variants.edges.map((edge) => edge.node);
              const checked = selectedProductIds.includes(product._id);

              return (
                <div className="product-pick-row" key={product._id}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setSelectedProductIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, product._id]))
                            : current.filter((id) => id !== product._id),
                        );

                        if (!event.target.checked) {
                          setSelectedVariantByProduct((current) => {
                            const next = { ...current };
                            delete next[product._id];
                            return next;
                          });
                        }
                      }}
                    />
                    <span>
                      <strong>{product.title}</strong>
                      <small>{product._id}</small>
                    </span>
                  </label>

                  <div className="variant-check-list" aria-disabled={!checked}>
                    {variants.length ? (
                      variants.map((variant) => {
                        const selectedVariants =
                          selectedVariantByProduct[product._id] ?? [];

                        return (
                          <label className="variant-check" key={variant._id}>
                            <input
                              type="checkbox"
                              disabled={!checked}
                              checked={selectedVariants.includes(variant._id)}
                              onChange={(event) => {
                                setSelectedVariantByProduct((current) => {
                                  const currentVariants = current[product._id] ?? [];

                                  return {
                                    ...current,
                                    [product._id]: event.target.checked
                                      ? Array.from(
                                          new Set([
                                            ...currentVariants,
                                            variant._id,
                                          ]),
                                        )
                                      : currentVariants.filter(
                                          (id) => id !== variant._id,
                                        ),
                                  };
                                });
                              }}
                            />
                            <span>{variantTitle(variant)}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span className="variant-empty">All variants</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </BlockStack>
      </Modal>

      <Modal
        open={investorModalOpen}
        title="Manage investors"
        size="lg"
        onClose={() => setInvestorModalOpen(false)}
        secondaryAction={{
          content: "Close",
          variation: "outline",
          onAction: () => setInvestorModalOpen(false),
        }}
      >
        <BlockStack gap={20}>
          <Text as="p" size="sm" color="secondary">
            Add investors with a login password. Then assign products to them
            from the product assignment modal.
          </Text>

          <div className="assignment-form modal-form">
            <label>
              <span>Name</span>
              <input
                value={newInvestorName}
                onChange={(event) => setNewInvestorName(event.target.value)}
                placeholder="Investor name"
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={newInvestorEmail}
                onChange={(event) => setNewInvestorEmail(event.target.value)}
                placeholder="investor@example.com"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={newInvestorPassword}
                onChange={(event) => setNewInvestorPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />
            </label>

            <label className="form-action-label">
              <span>&nbsp;</span>
              <button
                className="form-action-button"
                type="button"
                onClick={() => void createNewInvestor()}
              >
                Add investor
              </button>
            </label>
          </div>

          <div className="table-wrap modal-table">
            <table>
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Assigned products</th>
                  <th>Sold</th>
                  <th>Sales</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {investorRows.map((investor) => {
                  const investorAssignments = assignments.filter(
                    (assignment) => assignment.investorEmail === investor.email,
                  );
                  const soldQuantity = investorAssignments.reduce(
                    (total, assignment) =>
                      total + (assignment.sales?.soldQuantity ?? 0),
                    0,
                  );
                  const sales = investorAssignments.reduce(
                    (total, assignment) =>
                      total + (assignment.sales?.grossSales ?? 0),
                    0,
                  );

                  return (
                    <tr key={investor.email}>
                      <td>
                        <strong>{investor.name}</strong>
                        <span>{investor.email}</span>
                      </td>
                      <td>{investor.products}</td>
                      <td>{soldQuantity}</td>
                      <td>{formatCurrency(sales)}</td>
                      <td>
                        <Badge variant="success">{investor.status}</Badge>
                      </td>
                      <td>
                        <InlineStack gap={8} alignItems="center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setInvestorModalOpen(false);
                              openAssignmentModalForInvestor(investor);
                            }}
                          >
                            Assign product
                          </Button>
                          <Button
                            aria-label={`Delete ${investor.name}`}
                            className="icon-action"
                            color="danger"
                            icon={<Trash2 size={15} />}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => openDeleteInvestorModal(investor)}
                          />
                        </InlineStack>
                      </td>
                    </tr>
                  );
                })}
                {!investorRows.length && (
                  <tr>
                    <td colSpan={6}>
                      <span>No investors assigned yet.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BlockStack>
      </Modal>

      <Modal
        open={deleteInvestorModalOpen}
        title="Delete investor"
        size="sm"
        onClose={closeDeleteInvestorModal}
        primaryAction={{
          content: "Delete investor",
          loading: deletingInvestor,
          onAction: deleteInvestorFromDashboard,
        }}
        secondaryAction={{
          content: "Cancel",
          variation: "outline",
          onAction: closeDeleteInvestorModal,
        }}
      >
        {pendingDeleteInvestor && (
          <div className="delete-confirmation">
            <span className="delete-confirmation-icon" aria-hidden="true">
              <Trash2 size={22} />
            </span>
            <BlockStack gap={10}>
              <Text as="p" size="sm" weight="bold">
                Delete {pendingDeleteInvestor.name}?
              </Text>
              <Text as="p" size="sm" color="secondary">
                This will remove the investor login and unassign{" "}
                {pendingDeleteInvestor.products} product
                {pendingDeleteInvestor.products === 1 ? "" : "s"} from this
                investor. Sales data in Soppiya orders will not be deleted.
              </Text>
              <div className="delete-confirmation-meta">
                {pendingDeleteInvestor.email}
              </div>
            </BlockStack>
          </div>
        )}
      </Modal>
    </main>
  );
}

export default App;
