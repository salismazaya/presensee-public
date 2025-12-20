import Footer from "../../components/PiketFooter";
import Navbar from "../../components/Navbar";
import ChangePasswordComponent from "../../components/ChangePassword";

export default function PiketChangePassword() {
  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Navbar />

      <ChangePasswordComponent />

      <Footer />
    </div>
  );
}
