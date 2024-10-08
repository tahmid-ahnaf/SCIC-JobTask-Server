const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.buwy59t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("productsDB").collection("users");

    const productCollection = client.db("productsDB").collection("products");
    const paymentCollection = client.db("productsDB").collection("payments");

    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get("/paginatedproducts", async (req, res) => {
      const page = parseInt(req.query.page) - 1;
      const size = parseInt(req.query.size);
      const result = await productCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/productCount", async (req, res) => {
      const count = await productCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get("/products/:name", async (req, res) => {
      const name = req.params.name;

      const query = { productName: { $regex: name, $options: "i" } };
      const product = await productCollection.find(query).toArray();
      res.send(product);
    });

    app.get("/filteredproducts", async (req, res) => {
      const {
        productName,
        brand,
        category,
        minPrice,
        maxPrice,
        lowToHigh,
        newestFirst,
        page,
        size
      } = req.query;

      const pageVal = parseInt(page) - 1;
      const sizeVal = parseInt(size);

      const query = {};

      if (brand && brand!="All") {
        query.brand = { $regex: brand, $options: "i" };
      }

      if (productName) {
        query.productName = { $regex: productName, $options: "i" };
      }

      if (category && category!="All") {
        query.category = { $regex: category, $options: "i" };
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) {
          query.price.$gte = parseFloat(minPrice);
        }
        if (maxPrice) {
          query.price.$lte = parseFloat(maxPrice);
        }
      }

      const sort = {};

      if (lowToHigh==="Ascending") {
        sort.price = 1; // Ascending order
      } else if(lowToHigh==="Descending") {
        sort.price = -1; // Descending order
      }

      if (newestFirst) {
        sort.dateAdded = -1; // Descending order (newest first)
      }

      try {
        const totalCount = await productCollection.countDocuments(query); 
        const result = await productCollection.find(query).sort(sort).skip(pageVal * sizeVal)
        .limit(sizeVal).toArray();
        // console.log(totalCount);
        res.send({totalCount,result});
      } catch (err) {
        res
          .status(500)
          .send({ message: "Error fetching products", error: err });
      }
    });

    app.get("/categories", async (req, res) => {
      const result = await productCollection.distinct("category");
      res.send(result);
    });

    app.get("/brands", async (req, res) => {
      const result = await productCollection.distinct("brand");
      res.send(result);
    });



    // users related api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/tasks", async (req, res) => {
      const newQuery = req.body;
      const result = await taskCollection.insertOne(newQuery);
      res.send(result);
    });

    app.get("/tasks", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const options = {
        sort: { date: -1 },
      };
      const result = await taskCollection.find(query, options).toArray();
      res.send(result);
    });

    app.get("/employees", async (req, res) => {
      const query = { role: "employee" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/employees/verify", async (req, res) => {
      const email = req.query.email;
      const isVerified = req.query.isVerified;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          verified: isVerified,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/employees/makeHr", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: "hr",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/updateSalary", async (req, res) => {
      const email = req.query.email;
      const newSalary = req.query.newSalary;
      console.log(newSalary);

      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      console.log(user.salary, newSalary);
      let result;
      if (user.salary <= newSalary) {
        const updatedDoc = {
          $set: {
            salary: newSalary,
          },
        };
        result = await userCollection.updateOne(filter, updatedDoc);
      }

      res.send(result);
    });

    app.get("/verifiedList", async (req, res) => {
      const query = { role: { $in: ["employee", "hr"] }, verified: "true" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log("payment info", payment);

      res.send({ paymentResult });
    });

    app.get("/details", async (req, res) => {
      const email = req.query.email;
      const query = { paidTo: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("products is sitting");
});

app.listen(port, () => {
  console.log(`products is sitting on port ${port}`);
});
