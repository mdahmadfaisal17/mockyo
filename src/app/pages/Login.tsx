import { useEffect } from "react";
import { useNavigate } from "react-router";
import { openAuthModal } from "../imports/authModalStore";

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    openAuthModal("login");
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
}
