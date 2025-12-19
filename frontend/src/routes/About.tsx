import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import AboutComponent from "../components/About";

export default function About() {
  return (
    <div className="min-h-screen bg-base-200 font-sans pb-24">
      <Navbar />

      <AboutComponent />

      <Footer active="about" />
    </div>
  );
}
