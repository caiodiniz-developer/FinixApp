import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Registered once — every module that needs GSAP imports it from here so the
// ScrollTrigger plugin is guaranteed to be active before it's used.
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
