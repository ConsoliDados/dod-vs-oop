import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const DEFAULT_PORT = 3333

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const port = Number(process.env.PORT ?? DEFAULT_PORT)
  await app.listen(port)
  // biome-ignore lint/suspicious/noConsole: bootstrap-level startup signal
  console.log(`dod-vs-oop-classic listening on http://localhost:${port}`)
}
bootstrap()
