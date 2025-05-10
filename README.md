
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Setup

This application uses Firebase for its backend. To run the application locally, you need to set up Firebase environment variables.

1.  **Create a `.env.local` file** in the root directory of your project.
2.  **Add your Firebase project configuration** to this file. It should look like this:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
    # Optional: Only if you use Firebase Analytics
    # NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID"
    ```

    Replace the placeholder values (`"YOUR_API_KEY"`, etc.) with your actual Firebase project's configuration.

    **How to find your Firebase project configuration:**
    *   Go to your [Firebase Console](https://console.firebase.google.com/).
    *   Select your project (or create one if you haven't).
    *   In the project overview, click on the **Project settings** (gear icon) next to "Project Overview".
    *   Under the **General** tab, scroll down to the "Your apps" section.
    *   If you haven't registered a web app yet, click the web icon (`</>`) to add one. Follow the prompts.
    *   Once you have a web app registered, find the "Firebase SDK snippet" section and select **Config**.
    *   The configuration object shown there contains the values you need (`apiKey`, `authDomain`, `projectId`, etc.).
    *   **Important:** Ensure these variables start with `NEXT_PUBLIC_` to be accessible on the client-side by Next.js.

3.  **Restart your development server** if it's already running for the changes to take effect.

With these variables set, the application should be able to connect to your Firebase project.

## Database Setup (Firestore)

This application uses Firestore to store user profiles and tasks.

### Firestore Rules

You need to set up Firestore security rules to allow users to read and write their own data. A basic set of rules might look like this. You should refine these for production use.

1.  Go to your [Firebase Console](https://console.firebase.google.com/).
2.  Select your project.
3.  Navigate to **Firestore Database** in the Build section of the sidebar.
4.  Click on the **Rules** tab.
5.  Replace the existing rules with something like the following:

    ```firestore.rules
    rules_version = '2';

    service cloud.firestore {
      match /databases/{database}/documents {

        // Profiles: Users can read any profile, but only write their own.
        match /profiles/{userId} {
          allow read: if true;
          allow write: if request.auth != null && request.auth.uid == userId;
        }

        // Tasks: Users can manage (create, read, update, delete) their own tasks.
        // They can read tasks assigned to them or created by them.
        match /tasks/{taskId} {
          allow read: if request.auth != null && 
                       (resource.data.assignee_id == request.auth.uid || resource.data.created_by_id == request.auth.uid || request.auth.uid in resource.data.viewers); // Example: if you add a viewers field
          allow create: if request.auth != null && request.resource.data.created_by_id == request.auth.uid;
          allow update, delete: if request.auth != null && resource.data.created_by_id == request.auth.uid;
          // More granular update rules might be needed (e.g., assignee can update status)
        }
      }
    }
    ```

    **Explanation:**
    *   `profiles/{userId}`:
        *   `allow read: if true;`: Anyone can read profiles (e.g., for assignee display names). Adjust if you need stricter privacy.
        *   `allow write: if request.auth != null && request.auth.uid == userId;`: Only the authenticated user whose UID matches the document ID (`userId`) can create or update their own profile.
    *   `tasks/{taskId}`:
        *   `allow read`: Authenticated users can read tasks if they are the assignee or the creator.
        *   `allow create`: Authenticated users can create tasks if the `created_by_id` in the new task data matches their own UID.
        *   `allow update, delete`: Authenticated users can update or delete tasks if they were the creator. You might want to expand update permissions (e.g., allow assignees to change status).

6.  Click **Publish**.

### Data Structure

*   **`profiles` collection:**
    *   Each document ID is the Firebase `uid` of the user.
    *   Fields: `name` (string), `email` (string), `avatar_url` (string, optional).
*   **`tasks` collection:**
    *   Each document has an auto-generated ID.
    *   Fields: `title` (string), `description` (string), `due_date` (Timestamp), `priority` (string: "Low", "Medium", "High"), `status` (string: "To Do", "In Progress", "Done"), `assignee_id` (string, user UID, optional), `created_by_id` (string, user UID), `created_at` (Timestamp), `updated_at` (Timestamp).

When a user registers, a new document is created in the `profiles` collection using their UID as the document ID and storing their name and email.

## Authentication

Firebase Authentication is used for user sign-up and login. Email/password authentication is enabled by default when you set up Firebase.

### Customizing Firebase Email Templates

Firebase allows you to customize authentication emails (like verification, password reset) in the Firebase Console:

1.  Go to your [Firebase Console](https://console.firebase.google.com/).
2.  Select your project.
3.  Navigate to **Authentication** (under the Build section).
4.  Click on the **Templates** tab.
5.  You can edit the email templates here. They use a simple templating language. For instance, to include the user's display name (which we set during registration), you might use `{{displayName}}`.
    *   Example in the "Email address verification" template:
        ```html
        Hello {{displayName}},

        Follow this link to verify your email address.
        {{link}}
        ```
    Make sure your application provides the `displayName` to Firebase Auth when creating or updating a user profile if you want to use it in templates. The current `register` function in `src/lib/auth.ts` updates the Firebase user's `displayName`.

By following these setup steps, your Next.js application should be correctly configured to use Firebase for authentication and Firestore for its database.
