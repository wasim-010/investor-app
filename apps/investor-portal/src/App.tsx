import {
  BarChart3,
  Boxes,
  DollarSign,
  LogOut,
  PackageCheck,
  Search,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.PUBLIC_APP_API_URL ??
  import.meta.env.PUBLIC_DUAZON_API_URL ??
  "http://127.0.0.1:4000";
const SESSION_STORAGE_KEY = "soppiya_investor_session";

const formatMoney = (value: number) => `৳${value.toFixed(2)}`;

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

type InvestorDashboard = {
  investor: {
    email: string;
    name: string;
  };
  metrics: {
    assignedProducts: number;
    totalOrders: number;
    totalSoldQuantity: number;
    totalSales: number;
    stockLeft: number | null;
  };
  assignments: Assignment[];
};

type InvestorLoginResponse = InvestorDashboard & {
  session: string;
};

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<InvestorDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboardBySession = async (session: string) => {
    const response = await fetch(`${API_BASE_URL}/api/investor/dashboard`, {
      headers: {
        authorization: `Bearer ${session}`,
      },
    });
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      const body = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
      throw new Error(body?.error ?? "Unable to restore investor dashboard");
    }

    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `Expected JSON from API, received ${contentType || "unknown"}: ${text.slice(
          0,
          80,
        )}`,
      );
    }

    return response.json() as Promise<InvestorDashboard>;
  };

  useEffect(() => {
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!storedSession) {
      return;
    }

    setLoading(true);

    loadDashboardBySession(storedSession)
      .then((restoredDashboard) => {
        setDashboard(restoredDashboard);
        setEmail(restoredDashboard.investor.email);
        setError("");
      })
      .catch((caughtError) => {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setDashboard(null);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to restore session",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError("Enter investor email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/investor/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        const body = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : null;
        throw new Error(body?.error ?? "Unable to load investor dashboard");
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Expected JSON from API, received ${contentType || "unknown"}: ${text.slice(
            0,
            80,
          )}`,
        );
      }

      const nextDashboard = (await response.json()) as InvestorLoginResponse;
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextDashboard.session);
      setDashboard(nextDashboard);
      setEmail(nextDashboard.investor.email);
      setPassword("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to login",
      );
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setDashboard(null);
    setPassword("");
    setError("");
  };

  const metrics = [
    {
      label: "Assigned products",
      value: dashboard?.metrics.assignedProducts ?? 0,
      icon: PackageCheck,
    },
    {
      label: "Total orders",
      value: dashboard?.metrics.totalOrders ?? 0,
      icon: Boxes,
    },
    {
      label: "Sold quantity",
      value: dashboard?.metrics.totalSoldQuantity ?? 0,
      icon: BarChart3,
    },
    {
      label: "Total sales",
      value: formatMoney(dashboard?.metrics.totalSales ?? 0),
      icon: DollarSign,
    },
  ];

  return (
    <main className="investor-shell">
      <section className={dashboard ? "hero-panel compact" : "hero-panel"}>
        <div>
          <p className="eyebrow">Investor Portal</p>
          <h1>
            {dashboard
              ? `Welcome, ${dashboard.investor.name || dashboard.investor.email}`
              : "Track assigned Soppiya products from one clean dashboard."}
          </h1>
          {dashboard && (
            <p className="hero-subline">
              {dashboard.investor.email} · {dashboard.assignments.length} assigned
            </p>
          )}
        </div>

        {dashboard ? (
          <div className="session-card">
            <div>
              <span>Signed in as</span>
              <strong>{dashboard.investor.name || dashboard.investor.email}</strong>
            </div>
            <button type="button" onClick={logout}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        ) : (
          <form className="login-strip" onSubmit={login}>
            <label>
              Investor email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="investor@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
              />
            </label>
            <button type="submit" disabled={loading}>
              <Search size={16} />
              {loading ? "Signing in" : "Sign in"}
            </button>
          </form>
        )}
      </section>

      {error && <div className="alert">{error}</div>}

      {dashboard && (
        <>
          <section className="metric-row">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <article className="metric-card" key={metric.label}>
                  <span>
                    <Icon size={18} />
                  </span>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                </article>
              );
            })}
          </section>

          <section className="table-card">
            <div className="section-heading">
              <div>
                <h2>Assigned products</h2>
                <p>
                  {dashboard.investor.name} ({dashboard.investor.email}) -{" "}
                  {dashboard.assignments.length} assigned
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Sold</th>
                    <th>Assigned</th>
                    <th>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.assignments.map((assignment) => (
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
                      <td>{assignment.sales?.soldQuantity ?? 0}</td>
                      <td>{new Date(assignment.createdAt).toLocaleDateString()}</td>
                      <td>{formatMoney(assignment.sales?.grossSales ?? 0)}</td>
                    </tr>
                  ))}

                  {dashboard.assignments.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        No products are assigned to this investor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
