import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { createConnection } from "typeorm";
import * as amqp from "amqplib/callback_api";
import { Product } from "./entity/product";
import axios from 'axios'

createConnection().then((db) => {

  const productRepository = db.getMongoRepository(Product);

  amqp.connect(
    "amqps://ejhxxmkd:ovztyxVMAHiWQBSgoZJMQwUg6vg01Img@jackal.rmq.cloudamqp.com/ejhxxmkd",
    (error0, connection) => {
      if (error0) throw error0;

      connection.createChannel((error1, channel) => {
        if (error1) throw error1;

        channel.assertQueue("product_created", { durable: false });
        channel.assertQueue("product_updated", { durable: false });
        channel.assertQueue("product_deleted", { durable: false });

        const app = express();

        app.use(
          cors({
            origin: [
              "http://localhost:3000",
              "http://localhost:8080",
              "http://localhost:4200",
            ],
          })
        );

        app.use(express.json());

        channel.consume("product_created", async (msg) => {
            const eventProduct: Product = JSON.parse(msg.content.toString())
            const product: Product = new Product()
            product.admin_id = parseInt(eventProduct.id)
            product.title = eventProduct.title
            product.image = eventProduct.image
            product.likes = eventProduct.likes;
            await productRepository.save(product)
            console.log('product created')
        },{ noAck: true })


        channel.consume("product_updated", async(msg)=>{
            const eventProduct: Product = JSON.parse(msg.content.toString())
            const product = await productRepository.findOne({where: { admin_id: parseInt(eventProduct.id) }})
            productRepository.merge(product, {
                title: eventProduct.title,
                image: eventProduct.image,
                likes: eventProduct.likes
            })
            await productRepository.save(product)
            console.log('Product Updated')

      },{ noAck: true })

      channel.consume('product_deleted', async(msg)=>{
        const admin_id = parseInt(msg.content.toString())
        await productRepository.deleteOne({admin_id})
        console.log('Product deleted')
      })

      app.get('/api/products', async(req: Request,res:Response)=>{
        const products = await productRepository.find()
        return res.send(products)
      })

      app.post('/api/products/:id/like', async(req: Request,res:Response)=>{
        //console.log(req.params.id)
        const product: Product = await productRepository.findOneById(req.params.id)
        console.log(product)
        await axios.post(`http://localhost:8000/api/products/${product.admin_id}/like`, {});
        product.likes++
        await productRepository.save(product)
        return res.send(product)
      })

        console.log("Listening on port 8001");
        app.listen(8001);
        process.on('beforeExit', ()=>{
            console.log('closing')
            connection.close()
        })
      });
    }
  );
});
