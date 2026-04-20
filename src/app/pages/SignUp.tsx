import { useEffect } from "react";
import { useNavigate } from "react-router";
import { openAuthModal } from "../imports/authModalStore";

export default function SignUp() {
  const navigate = useNavigate();

  useEffect(() => {
    openAuthModal("signup");
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
}
