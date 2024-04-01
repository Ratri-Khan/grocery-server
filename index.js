const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pluunuw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

   // middlewares
   const verifyToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log("inside verify token", req.headers.authorization);
    if (!authorization) {
      return res.status(401).send({error: true, message: "unauthorized access" });
    }
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ error:true, message: "unauthorized access" });
      }
      req.decoded = decoded;
      next();
    });
  };

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("groceryDB").collection("users");
    const productCollection = client.db("groceryDB").collection("products");
    const discountCollection = client.db("groceryDB").collection("discount");
    const categoriesCollection = client.db("groceryDB").collection("categories");
    const popularCollection = client.db("groceryDB").collection("popular");
    const cartCollection = client.db("groceryDB").collection("carts");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // warning : use verifyJWT before using verifyAdmin
    const verifyAdmin =  async(req,res,next) =>{
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error:true, message:'forbidden message'});
      }
      next();
    }


    // users information
    // get user data from client side
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log("existing user", existingUser);
      if (existingUser) {
        return res.send({ message: "user already exists" });//for signIn with google
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    //get user data from mongodb
    app.get("/users",verifyToken,verifyAdmin , async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // for create admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    
    // security layer: verifyJWT
    // email same
    // check admin
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    // get data
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });
    app.get("/discount", async (req, res) => {
      const result = await discountCollection.find().toArray();
      res.send(result);
    });
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });
    app.get("/popular", async (req, res) => {
      const result = await popularCollection.find().toArray();
      res.send(result);
    });
    // for cart
    app.get("/carts",verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true , message: 'forbidden access'})
      }


      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const newCart = req.body;
      console.log(newCart);
      const result = await cartCollection.insertOne(newCart);
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Fresh Grocery!");
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
