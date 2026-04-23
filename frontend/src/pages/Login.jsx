import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";

function Login() {
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const $form = window.$(formRef.current);

    const parseError = (data) => {
      if (typeof data === "string") return data;
      if (data && data.detail) return data.detail;
      if (data && data.username && data.username[0]) return data.username[0];
      if (data && data.password && data.password[0]) return data.password[0];
      return "Invalid credentials.";
    };

    const onSubmit = (e) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      const payload = {
        username: (window.$("#username").val() || "").trim(),
        password: window.$("#password").val() || "",
      };

      window
        .$.ajax({
          url: API_BASE + "/auth/login/",
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify(payload),
        })
        .done((res) => {
          if (res && res.access) localStorage.setItem("access_token", res.access);
          if (res && res.refresh) localStorage.setItem("refresh_token", res.refresh);
          navigate("/dashboard");
        })
        .fail((xhr) => {
          const data = xhr.responseJSON || xhr.responseText;
          setError(parseError(data));
        })
        .always(() => {
          setLoading(false);
        });
    };

    $form.on("submit", onSubmit);
    return () => {
      $form.off("submit", onSubmit);
    };
  }, [navigate]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: "#f1f5f9" }}>
      <div className="card shadow-sm border-0 w-100" style={{ maxWidth: "440px", borderRadius: "14px" }}>
        <div className="card-body p-4">
          <h1 className="h3 mb-4 fw-semibold text-dark">Login</h1>

          <form ref={formRef} className="d-grid gap-3">
            <input
              id="username"
              name="username"
              className="form-control"
              placeholder="Username"
              autoComplete="username"
            />
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              placeholder="Password"
              autoComplete="current-password"
            />

            {error ? <p className="small text-danger mb-0">{error}</p> : null}

            <button type="submit" disabled={loading} className="btn btn-primary w-100">
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-4 mb-0 small text-secondary">
            No account?{" "}
            <Link to="/register" className="text-decoration-none">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;