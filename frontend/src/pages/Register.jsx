import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";

function Register() {
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const $form = window.$(formRef.current);

    const parseError = (data) => {
      if (typeof data === "string") return data;
      if (data && data.username && data.username[0]) return data.username[0];
      if (data && data.password && data.password[0]) return data.password[0];
      if (data && data.email && data.email[0]) return data.email[0];
      if (data && data.detail) return data.detail;
      return "Registration failed.";
    };

    const onSubmit = (e) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      const payload = {
        username: (window.$("#username").val() || "").trim(),
        email: (window.$("#email").val() || "").trim(),
        password: window.$("#password").val() || "",
      };

      window
        .$.ajax({
          url: API_BASE + "/auth/register/",
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify(payload),
        })
        .done(() => {
          navigate("/");
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
          <h1 className="h3 mb-4 fw-semibold text-dark">Register</h1>

          <form ref={formRef} className="d-grid gap-3">
            <input
              id="username"
              name="username"
              className="form-control"
              placeholder="Username"
              autoComplete="username"
            />
            <input
              id="email"
              name="email"
              className="form-control"
              placeholder="Email"
              autoComplete="email"
            />
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              placeholder="Password"
              autoComplete="new-password"
            />

            {error ? <p className="small text-danger mb-0">{error}</p> : null}

            <button type="submit" disabled={loading} className="btn btn-primary w-100">
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="mt-4 mb-0 small text-secondary">
            Already registered?{" "}
            <Link to="/" className="text-decoration-none">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;