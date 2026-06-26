import { handleRequest } from "../src/app";

export default function handler(request: Request) {
  return handleRequest(request);
}
