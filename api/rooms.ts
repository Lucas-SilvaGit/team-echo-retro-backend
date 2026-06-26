import { handleRoomsRequest } from "../src/routes/rooms.js";
import { toRequest } from "./_bridge";

export default async function handler(req: any, res: any) {
  const response = await handleRoomsRequest(await toRequest(req));
  if (!response) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  await writeResponse(res, response);
}

async function writeResponse(res: any, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}
