import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Check if modern MongoDB URI is set
const MONGODB_URI = process.env.MONGODB_URI;
const isProductionMongo = MONGODB_URI && MONGODB_URI.startsWith('mongodb') && !MONGODB_URI.includes('MY_GEMINI_API_KEY');

// Initialize database directory for local json store if not using mongodb-atlas
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ==========================================
// MOCK DATABASE MODEL SIMULATION FOR PLAYGROUND
// ==========================================
class LocalDbModel {
  private filePath: string;
  private modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
    this.filePath = path.join(DATA_DIR, `${modelName.toLowerCase()}s.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private read(): any[] {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const items = JSON.parse(data);
      return items.map((item: any) => {
        if (item.createdAt) item.createdAt = new Date(item.createdAt);
        return item;
      });
    } catch {
      return [];
    }
  }

  private write(data: any[]) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async find(filter: any = {}): Promise<any[]> {
    let items = this.read();
    
    // Support basic filters
    const filtered = items.filter(item => {
      for (const key in filter) {
        if (filter[key] === undefined) continue;
        
        const filterVal = filter[key];
        const itemVal = item[key];

        if (filterVal && typeof filterVal === 'object' && !Array.isArray(filterVal)) {
          // MongoDB Operators integration: $in, $ne
          if ('$in' in filterVal) {
            const arr = filterVal['$in'];
            if (!Array.isArray(arr)) return false;
            if (!arr.includes(itemVal)) return false;
          }
          if ('$ne' in filterVal) {
            if (itemVal === filterVal['$ne']) return false;
          }
        } else {
          // Direct comparison
          if (itemVal !== filterVal) return false;
        }
      }
      return true;
    });

    return filtered.map(item => this.wrapDoc(item));
  }

  async findOne(filter: any): Promise<any | null> {
    const items = await this.find(filter);
    return items[0] || null;
  }

  async findById(id: string): Promise<any | null> {
    return this.findOne({ _id: id });
  }

  async create(data: any): Promise<any> {
    const items = this.read();
    const newItem = {
      _id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      createdAt: new Date(),
      likes: [],
      ...data
    };
    items.push(newItem);
    this.write(items);
    return this.wrapDoc(newItem);
  }

  async findByIdAndUpdate(id: string, update: any, options: { new?: boolean } = {}): Promise<any> {
    let items = this.read();
    const index = items.findIndex(item => item._id === id);
    if (index === -1) return null;

    let doc = { ...items[index] };

    // Support Mongoose operators $push and $pull
    if (update.$push) {
      for (const key in update.$push) {
        doc[key] = doc[key] || [];
        if (!doc[key].includes(update.$push[key])) {
          doc[key].push(update.$push[key]);
        }
      }
    } else if (update.$pull) {
      for (const key in update.$pull) {
        if (doc[key]) {
          doc[key] = doc[key].filter((val: any) => val !== update.$pull[key]);
        }
      }
    } else {
      // Ordinary update
      doc = { ...doc, ...update };
    }

    items[index] = doc;
    this.write(items);
    return this.wrapDoc(doc);
  }

  async findByIdAndDelete(id: string): Promise<any> {
    const items = this.read();
    const index = items.findIndex(item => item._id === id);
    if (index === -1) return null;
    const deleted = items.splice(index, 1)[0];
    this.write(items);
    return deleted;
  }

  async deleteOne(filter: any): Promise<{ deletedCount: number }> {
    const items = this.read();
    const initialCount = items.length;
    const index = items.findIndex(item => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
    if (index !== -1) {
      items.splice(index, 1);
      this.write(items);
    }
    return { deletedCount: initialCount - items.length };
  }

  async countDocuments(filter: any = {}): Promise<number> {
    const items = await this.find(filter);
    return items.length;
  }

  // Adds a chainable population mimicking mongoose `.populate()`
  private wrapDoc(item: any): any {
    if (!item) return null;
    const self = this;
    const doc = { ...item };
    
    // Mimic save()
    doc.save = async function() {
      const items = self.read();
      const index = items.findIndex(i => i._id === doc._id);
      const cleanDoc = { ...doc };
      delete cleanDoc.save;
      delete cleanDoc._populate;
      if (index === -1) {
        items.push(cleanDoc);
      } else {
        items[index] = cleanDoc;
      }
      self.write(items);
      return self.wrapDoc(cleanDoc);
    };

    return doc;
  }
}

// ==========================================
// REAL MONGOOSE SCHEMAS & CONFIG
// ==========================================
let mongooseConnectionStatus = false;

if (isProductionMongo) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Successfully connected to MongoDB.');
      mongooseConnectionStatus = true;
    })
    .catch((err) => {
      console.error('Error connecting to MongoDB, falling back to local JSON store:', err.message);
    });
} else {
  console.log('MONGODB_URI environment variable not configured. Running with persistent, file-based Local JSON Store.');
}

// Schemas Definitions for Real MongoDB
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  fitnessGoal: { type: String, default: 'General Fitness' },
  profilePic: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  image: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const followerSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Build standard Mongoose Models
const MongoUser = mongoose.model('User', userSchema);
const MongoPost = mongoose.model('Post', postSchema);
const MongoComment = mongoose.model('Comment', commentSchema);
const MongoFollower = mongoose.model('Follower', followerSchema);

// Build Local DB stores
const LocalUser = new LocalDbModel('User');
const LocalPost = new LocalDbModel('Post');
const LocalComment = new LocalDbModel('Comment');
const LocalFollower = new LocalDbModel('Follower');

// Unified API Interface Proxying
export const User = {
  find: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoUser.find(query) : LocalUser.find(query)),
  findOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoUser.findOne(query) : LocalUser.findOne(query)),
  findById: (id: string) => (isProductionMongo && mongooseConnectionStatus ? MongoUser.findById(id) : LocalUser.findById(id)),
  create: (data: any) => (isProductionMongo && mongooseConnectionStatus ? MongoUser.create(data) : LocalUser.create(data)),
  findByIdAndUpdate: (id: string, update: any, options?: any) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoUser.findByIdAndUpdate(id, update, { new: true, ...options }) : LocalUser.findByIdAndUpdate(id, update, options)),
  findByIdAndDelete: (id: string) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoUser.findByIdAndDelete(id) : LocalUser.findByIdAndDelete(id)),
  deleteOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoUser.deleteOne(query) : LocalUser.deleteOne(query)),
  countDocuments: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoUser.countDocuments(query) : LocalUser.countDocuments(query)),
};

export const Post = {
  find: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoPost.find(query) : LocalPost.find(query)),
  findOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoPost.findOne(query) : LocalPost.findOne(query)),
  findById: (id: string) => (isProductionMongo && mongooseConnectionStatus ? MongoPost.findById(id) : LocalPost.findById(id)),
  create: (data: any) => (isProductionMongo && mongooseConnectionStatus ? MongoPost.create(data) : LocalPost.create(data)),
  findByIdAndUpdate: (id: string, update: any, options?: any) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoPost.findByIdAndUpdate(id, update, { new: true, ...options }) : LocalPost.findByIdAndUpdate(id, update, options)),
  findByIdAndDelete: (id: string) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoPost.findByIdAndDelete(id) : LocalPost.findByIdAndDelete(id)),
  deleteOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoPost.deleteOne(query) : LocalPost.deleteOne(query)),
  countDocuments: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoPost.countDocuments(query) : LocalPost.countDocuments(query)),
};

export const Comment = {
  find: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoComment.find(query) : LocalComment.find(query)),
  findOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoComment.findOne(query) : LocalComment.findOne(query)),
  findById: (id: string) => (isProductionMongo && mongooseConnectionStatus ? MongoComment.findById(id) : LocalComment.findById(id)),
  create: (data: any) => (isProductionMongo && mongooseConnectionStatus ? MongoComment.create(data) : LocalComment.create(data)),
  findByIdAndUpdate: (id: string, update: any, options?: any) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoComment.findByIdAndUpdate(id, update, { new: true, ...options }) : LocalComment.findByIdAndUpdate(id, update, options)),
  findByIdAndDelete: (id: string) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoComment.findByIdAndDelete(id) : LocalComment.findByIdAndDelete(id)),
  deleteOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoComment.deleteOne(query) : LocalComment.deleteOne(query)),
  countDocuments: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoComment.countDocuments(query) : LocalComment.countDocuments(query)),
};

export const Follower = {
  find: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoFollower.find(query) : LocalFollower.find(query)),
  findOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoFollower.findOne(query) : LocalFollower.findOne(query)),
  findById: (id: string) => (isProductionMongo && mongooseConnectionStatus ? MongoFollower.findById(id) : LocalFollower.findById(id)),
  create: (data: any) => (isProductionMongo && mongooseConnectionStatus ? MongoFollower.create(data) : LocalFollower.create(data)),
  findByIdAndUpdate: (id: string, update: any, options?: any) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoFollower.findByIdAndUpdate(id, update, { new: true, ...options }) : LocalFollower.findByIdAndUpdate(id, update, options)),
  findByIdAndDelete: (id: string) => 
    (isProductionMongo && mongooseConnectionStatus ? MongoFollower.findByIdAndDelete(id) : LocalFollower.findByIdAndDelete(id)),
  deleteOne: (query: any) => (isProductionMongo && mongooseConnectionStatus ? MongoFollower.deleteOne(query) : LocalFollower.deleteOne(query)),
  countDocuments: (query?: any) => (isProductionMongo && mongooseConnectionStatus ? MongoFollower.countDocuments(query) : LocalFollower.countDocuments(query)),
};

// Population helper to resolve user profiles on local JSON store mock records
export async function populateUser(refId: string): Promise<any | null> {
  const user = await User.findById(refId);
  if (!user) return null;
  const copy = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete copy.password;
  return copy;
}

export function isUsingLocalDb(): boolean {
  return !isProductionMongo || !mongooseConnectionStatus;
}
