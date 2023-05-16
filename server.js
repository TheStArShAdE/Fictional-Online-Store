// necessary libraries
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { MongoClient, ObjectID } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet()); // Helmet for setting various HTTP headers for security
app.use(cors()); // Enable cross-origin resource sharing (CORS) 
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(morgan('combined')); // Logging HTTP requests

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, //milliseconds
    max: 100 // 100 requests per IP Address
});
app.use(limiter);

// MongoDB configuration
const MONGO_URI = 'mongodb+srv://starshade:Zamir0407@fictionalonlinestore.9ybvzgf.mongodb.net/';
const DB_NAME = 'FictionalOnlineStore';

// Connecting MongoDb
let db;
async function connectToDatabase() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}
connectToDatabase();

// Validating JWT and extracting userID
function authenticateJWT(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    jwt.verify(token, 'uBCov5Hb-HWvYcNmCBMKlDv4Z-1xN5n4Nfbac3JccrrCycboCY6-c25jqZ-Lk1mx', (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.userId = decoded.userId;
        next();
    });
}

// Route for user registration
app.post(
    '/api/users/register',
    [
        body('username').trim().notEmpty().isLength({ min: 3 }),
        body('password').trim().notEmpty().isLength({ min: 6 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { username, password } = req.body;

            const usersCollection = db.collection('users');

            // Check if the username is taken
            const existingUser = await usersCollection.findOne({ username });
            if (existingUser) {
                return res.status(409).json({ message: 'Username is already taken' });
            }

            //Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            //Crreate a new User
            const newUser = {
                username,
                password: hashedPassword
            };

            //Insert the user document
            const result = await usersCollection.insertOne(newUser);

            if (result.insertedCount === 0) {
                return res.status(500).json({ message: 'Error registering user' });
            }

            res.json({ message: 'User registered successfully' });
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).json({ message: 'Error registering user' });
        }
    });

// Route for user login
app.post('/api/users/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usersCollection = db.collection('users');

        // Find user by username
        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Compare the provided password with the stored password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, 'uBCov5Hb-HWvYcNmCBMKlDv4Z-1xN5n4Nfbac3JccrrCycboCY6-c25jqZ-Lk1mx');

        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Route for adding products to the shopping cart
app.post('/api/cart', authenticateJWT, async (req, res) => {
    try {
        const userId = req.userId;
        const productId = req.body.productId;
        const quantity = req.body.quantity || 1; // Default quantity is 1

        const usersCollection = db.collection('users');

        // Find the user and update their cart with the new product
        const result = await usersCollection.updateOne(
            { _id: ObjectID(userId) },
            { $addToSet: { cart: { productId: ObjectID(productId), quantity: quantity } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        res.status(500).json({ message: 'Error adding product to cart' });
    }
});

// Route for placing an order
app.post('/api/orders', authenticateJWT, async (req, res) => {
    try {
        const userId = req.userId;

        const usersCollection = db.collection('users');
        const ordersCollection = db.collection('orders');

        // Find the user and retrieve their cart
        const user = await usersCollection.findOne({ _id: ObjectID(userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const cart = user.cart;

        // Create an order document with the user's cart
        const order = {
            userId: ObjectID(userId),
            products: cart,
            createdAt: new Date()
        };

        // Insert the order document
        const result = await ordersCollection.insertOne(order);

        if (result.insertedCount === 0) {
            return res.status(500).json({ message: 'Error placing order' });
        }

        // Clear the user's cart after placing the order
        await usersCollection.updateOne({ _id: ObjectID(userId) }, { $set: { cart: [] } });

        res.json({ message: 'Order placed successfully', orderId: result.insertedId });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ message: 'Error placing order' });
    }
});

// Route for searching products by name, description, and category
app.get('/api/products/search', async (req, res) => {
    try {
        const searchQuery = req.query.q || ''; // Get the search query from the query parameter
        const productsCollection = db.collection('products');

        // Create a search query using case-insensitive regex
        const query = {
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                { category: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        const products = await productsCollection.find(query).toArray();

        res.json({ products });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ message: 'Error searching products' });
    }
});

// Route for creating a product
app.post(
    '/api/products',
    [
        body('name').trim().notEmpty(),
        body('description').trim().notEmpty(),
        body('category').trim().notEmpty(),
        body('price').isNumeric().notEmpty()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, description, category, price } = req.body;
            const productsCollection = db.collection('products');

            //Check if a product with the same name already exists
            const existingProduct = await productsCollection.findOne({ name });
            if (existingProduct) {
                return res.status(409).json({ message: 'Product name already exists' });
            }

            const product = {
                name,
                description,
                category,
                price: parseFloat(price)
            };

            const result = await productsCollection.insertOne(product);

            if (result.insertedCount === 0) {
                return res.status(500).json({ message: 'Error creating product' });
            }

            res.json({ message: 'Product created successfully', productId: result.insertedId });
        } catch (error) {
            console.error('Error creating product:', error);
            res.status(500).json({ message: 'Error creating product' });
        }
    }
);

// Route for reading all products with pagination
app.get('/api/products/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
        const limit = parseInt(req.query.limit) || 10; // Get the number of items per page from the query parameter
        const skip = (page - 1) * limit;

        const productsCollection = db.collection('products');

        const totalProducts = await productsCollection.countDocuments();

        const products = await productsCollection
            .find()
            .skip(skip)
            .limit(limit)
            .toArray();

        res.json({ products, totalProducts });
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({ message: 'Error reading products' });
    }
});

// Route for updating a product
app.put(
    '/api/products/:id',
    [
        body('name').trim().notEmpty(),
        body('description').trim().notEmpty(),
        body('category').trim().notEmpty(),
        body('price').isNumeric().notEmpty()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const productId = req.params.id;
            const { name, description, category, price } = req.body;
            const productsCollection = db.collection('products');

            // Check if a product with the same name already exists
            const existingProduct = await productsCollection.findOne({ _id: ObjectID(productId) });
            if (!existingProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            //Check if the updated name conflicts with another product
            const duplicateProduct = await productsCollection.findOne({ name, _id: { $ne: ObjectID(productId) } });
            if (duplicateProduct) {
                return res.status(409).json({ message: 'Product name already exists' });
            }

            const updatedProduct = {
                name,
                description,
                category,
                price: parseFloat(price)
            };

            const result = await productsCollection.updateOne(
                { _id: ObjectID(productIdt) },
                { $set: updatedProduct }
            );

            if (result.modifiedCount === 0) {
                return res.status(500).json({ message: 'Error updating product' });
            }

            res.json({ message: 'Product updated successfully', productId });
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Error updating product' });
        }
    }
);

// Route for deleting a product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const productsCollection = db.collection('products');

        const result = await productsCollection.deleteOne({ _id: ObjectID(productId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully', productId });
    } catch (error) {
        console.error('Error deleteing product:', error);
        res.status(500).json({ message: 'Error deleting product' });
    }
});

// Route for retrieving all orders with pagination
app.get('/api/orders', authenticateJWT, async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1; // Default page is 1
        const limit = parseInt(req.query.limit) || 10; // Default limit is 10
        const skip = (page - 1) * limit;

        const usersCollection = db.collection('users');
        const ordersCollection = db.collection('orders');

        // Check if the user exists
        const user = await usersCollection.findOne({ _id: ObjectID(userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Retrieve total count of orders for the user
        const totalOrders = await ordersCollection.countDocuments({ userId: ObjectID(userId) });

        // Retrieve the paginated list of orders for the user
        const orders = await ordersCollection
            .find({ userId: ObjectID(userId) })
            .skip(skip)
            .limit(limit)
            .toArray();

        res.json({ orders, totalOrders });
    } catch (error) {
        console.error('Error retrieving orders:', error);
        res.status(500).json({ message: 'Error retrieving orders' });
    }
});

// Route for removing a product from the shopping cart
app.delete('/api/cart/:productId', authenticateJWT, async (req, res) => {
    try {
        const userId = req.userId;
        const productId = req.params.productId;
        const usersCollection = db.collection('users');

        // Check if the user exists
        const user = await usersCollection.findOne({ _id: ObjectID(userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove the product from the user's cart
        const updatedUser = await usersCollection.findOneAndUpdate(
            { _id: ObjectID(userId) },
            { $pull: { cart: { productId: ObjectID(productId) } } },
            { returnOriginal: false }
        );

        if (!updatedUser.value) {
            return res.status(500).json({ message: 'Error removing product from cart' });
        }

        res.json({ message: 'Product removed from cart successfully' });
    } catch (error) {
        console.error('Error removing product from cart:', error);
        res.status(500).json({ message: 'Error removing product from cart' });
    }
});

//Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});