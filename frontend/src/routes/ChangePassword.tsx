import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import ChangePasswordComponent from "../components/ChangePassword";

export default function ChangePassword() {
  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Navbar />

      <ChangePasswordComponent />

      <Footer />
    </div>
  );
}
