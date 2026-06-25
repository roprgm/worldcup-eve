import { defineSandbox } from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

// This agent answers questions from app-runtime tools and never runs shell, file,
// or code tools, so it needs no real binaries or VM. just-bash avoids spinning up
// a microsandbox VM (or requiring Docker) for nothing.
export default defineSandbox({ backend: justbash() });
