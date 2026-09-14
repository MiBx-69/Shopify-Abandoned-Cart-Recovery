import { redirect } from "@remix-run/node";

export const loader = async () => {
  return redirect("/test");
};

export default function Index() {
  return null;
}
