const admin = require("firebase-admin");
const express = require("express");
const app = express();

var serviceAccount = require("./earthcare-b24df-firebase-adminsdk-aav7p-e2ac54b36f.json");
app.use(express.json());
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Hàm gửi thông báo
function sendNotificationToAllUsers(title, body, image) {
  db.collection("user-tokens")
    .get()
    .then((querySnapshot) => {
      const tokens = [];
      querySnapshot.forEach((doc) => {
        tokens.push(doc.data().token);
      });

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: title,
            body: body,
            image: image,
          },
          tokens: tokens,
        };

        admin
          .messaging()
          .sendMulticast(message)
          .then((response) => {
            console.log("Successfully sent message:", response);
          })
          .catch((error) => {
            console.log("Error sending message:", error);
          });
      } else {
        console.log("Không có token nào được tìm thấy trong cơ sở dữ liệu.");
      }
    })
    .catch((error) => {
      console.log("Error getting documents: ", error);
    });
}

app.post("/send-notification", (req, res) => {
  console.log(req.body);
  sendNotificationToAllUsers(req.body.title, req.body.body, req.body.image);
  db.collection("notifications")
    .add({
      title: req.body.title,
      body: req.body.body,
      image: req.body.image,
      created_at: new Date(),
      user_id: "all",
    })
    .then((docRef) => {
      console.log("Document written with ID: ", docRef.id);
    })
    .catch((error) => {
      console.error("Error adding document: ", error);
    });
  res.status(200).send("Successfully sent message");
});

function sendNotificationToUser(title, body, image, userId, db, admin, res) {
  db.collection("user-tokens")
    .doc(userId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const message = {
          notification: {
            title,
            body,
            image,
          },
          token: doc.data().token,
        };

        admin
          .messaging()
          .send(message)
          .then((response) => {
            console.log("Successfully sent message:", response);
            res.status(200).send("Successfully sent message");
          })
          .catch((error) => {
            console.log("Error sending message:", error);
            res.status(500).send("Error sending message");
          });

        db.collection("notifications")
          .add({
            title,
            body,
            image,
            created_at: new Date(),
            user_id: userId,
          })
          .then((docRef) => {
            console.log("Document written with ID: ", docRef.id);
          })
          .catch((error) => {
            console.error("Error adding document: ", error);
          });
      } else {
        console.log("Không tìm thấy người dùng trong cơ sở dữ liệu.");
        res.status(500).send("User not found in database");
      }
    })
    .catch((error) => {
      console.log("Error getting document:", error);
      res.status(500).send("Error getting document");
    });
}

app.post("/send-notification-to-user", (req, res) => {
  const { title, body, image, userId } = req.body;
  sendNotificationToUser(title, body, image, userId, db, admin, res);
});

const checkActivities = async () => {
  const activities = await db.collection("activities").get();
  const interestedActivities = await db
    .collection("interested_activities")
    .get();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  activities.forEach((activity) => {
    const startDateTime = activity.data().startDateTime.toDate();
    if (startDateTime.getDate() === tomorrow.getDate()) {
      interestedActivities.forEach((interestedActivity) => {
        if (interestedActivity.data().activity_id === activity.id) {
          sendNotificationToUser(
            "Hoạt động sẽ diễn ra vào ngày mai",
            activity.data().name,
            activity.data().image,
            interestedActivity.data().user_id,
            db,
            admin,
            res
          );
        }
      });
    }
  });
};

setInterval(checkActivities, 1000 * 60 * 60 * 12);

app.listen(3030, () => {
  console.log("Server running");
});
