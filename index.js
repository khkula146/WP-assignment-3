const express = require("express");
const Student = require("./database/models/studentModel");
const Instructor = require("./database/models/instructorModel");
const cors = require("cors");
const Course = require("./database/models/coursesModel");
const upload = require("./multer-cloudinary");


const mongoose = require("mongoose");
const uri = "mongodb+srv://shaheeruddin:Shaheer123!@cluster0.uuj4z.mongodb.net/coachingwebsite?retryWrites=true&w=majority&appName=Cluster0"

// Connect to MongoDB
mongoose.connect(uri)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.log("MongoDB connection error:", err));


const app = express();
const PORT = 6001;

app.use(express.json());
app.use(cors());


app.get("/", (req, res) => {
  res.send("Hello World");
});

// Middleware to authenticate student by email
const authenticateStudent = async (req, res, next) => {
  const { email, password } = req.query;

  if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }

  try {
    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).send({ message: "Student not found" });
    }

    if (student.password !== password) {
      return res.status(401).send({ message: "Invalid password" });
    }

    req.student = student;
    next();
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
};

// Add a new student
app.post("/addStudent", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const newStudent = new Student({
      name: name,
      email: email,
      password: password,
      date: new Date(),
    });
    await newStudent.save();
    res.send(newStudent);
  } catch (error) {
    res.send(error);
  }
});

// Authenticate student route
app.get("/authenticateStudent", authenticateStudent, (req, res) => {
  res.status(200).send({
    message: "Authenticated successfully",
    student: {
      name: req.student.name,
      email: req.student.email,
    },
    userType: "student",
  });
});

// Add a new instructor
app.post("/addInstructor", async (req, res) => {
  const { name, email, username, password } = req.body;

  try {
    const newInstructor = new Instructor({
      name: name,
      email: email,
      username: username,
      password: password,
      date: new Date(),
    });
    await newInstructor.save();
    res.send(newInstructor);
  } catch (error) {
    res.send(error);
  }
});

// Middleware to authenticate instructor by email
const authenticateInstructor = async (req, res, next) => {
  const { email, password } = req.query;

  if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }

  try {
    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
      return res.status(404).send({ message: "Instructor not found" });
    }

    if (instructor.password !== password) {
      return res.status(401).send({ message: "Invalid password" });
    }

    req.instructor = instructor;
    next();
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
};

// Authenticate instructor route
app.get("/authenticateInstructor", authenticateInstructor, async (req, res) => {
  try {
    // Populate the courses field with the full course details
    const instructor = await Instructor.findById(req.instructor._id).populate('courses');

    res.status(200).send({
      message: "Authenticated successfully",
      instructor: {
        id: instructor._id,
        name: instructor.name,
        email: instructor.email,
        username: instructor.username,
        courses: instructor.courses,
      },
      userType: "instructor",
    });
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

// Get Instructor by id
app.get("/getInstructor/:id", async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id).populate('courses');
    res.status(200).send(instructor);
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

// Update Instructor
app.put("/updateInstructor", async (req, res) => {
  const { email, name } = req.body;

  // Validate input
  if (!email || !name) {
    return res.status(400).send({ message: "Email and new name are required" });
  }

  try {
    const instructor = await Instructor.findOneAndUpdate(
      { email }, // Find the instructor by email
      { name: name }, // Update the name
      { new: true } // Return the updated document
    );

    if (!instructor) {
      return res.status(404).send({ message: "Instructor not found" });
    }

    // Respond with the updated instructor data
    res.status(200).send({
      message: "Instructor updated successfully",
      instructor: {
        name: instructor.name,
        email: instructor.email,
        username: instructor.username,
        courses: instructor.courses,
      },
    });
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

// Upload Course
app.post(
  "/uploadCourse",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    const { title, description, instructorId, username } = req.body;
    console.log(instructorId);
    try {
      if (!req.files.image || !req.files.video) {
        return res
          .status(400)
          .json({ message: "Image and video are required" });
      }

      const imageUrl = req.files.image[0].path;
      const videoUrl = req.files.video[0].path;

      const newCourse = new Course({
        title,
        description,
        imageUrl,
        videoUrl,
        createdBy: instructorId,
        username,
      });

      const savedCourse = await newCourse.save();

      const updatedInstructor = await Instructor.findByIdAndUpdate(
        { _id: instructorId },
        { $push: { courses: savedCourse._id } },
        { new: true }
      ).populate("courses");

      res.status(201).json({
        message: "Course uploaded successfully",
        course: savedCourse,
        updatedInstructor: updatedInstructor,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

// Get Courses
app.get("/getcourses", async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});

// Delete Course
app.delete("/deletecourses/:courseId", async (req, res) => {
  try {
    console.log(req.params);
    const courseId = req.params.courseId;

    const deletedCourse = await Course.findByIdAndDelete({ _id: courseId });

    if (!deletedCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    const updatedInstructor = await Instructor.findOneAndUpdate(
      { courses: courseId },
      { $pull: { courses: courseId } },
      { new: true }
    ).populate("courses");

    res.status(200).json({
      message: "Course deleted successfully",
      deletedCourse,
      updatedInstructor,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting the course" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
