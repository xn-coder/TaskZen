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
    
    # Optional: For Firebase Emulators (if you use them)
    # Ensure these match your firebase.json emulator settings
    # NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="localhost:9099" 
    # NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST="localhost"
    # NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT="8080"
    # NEXT_PUBLIC_STORAGE_EMULATOR_HOST="localhost"
    # NEXT_PUBLIC_STORAGE_EMULATOR_PORT="9199"
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
          allow read: if request.auth != null; // Allow authenticated users to read profiles (e.g., for assignee display names)
          allow create: if request.auth != null && request.auth.uid == userId; // User can create their own profile
          allow update: if request.auth != null && request.auth.uid == userId; // User can update their own profile
          // No delete rule for profiles for now, can be added if needed
        }

        // Tasks:
        match /tasks/{taskId} {
          // Users can read tasks if they are the creator or an assignee.
          allow read: if request.auth != null && 
                       (resource.data.created_by_id == request.auth.uid || 
                        request.auth.uid in resource.data.assignee_ids);
          
          // Users can create tasks if the created_by_id matches their UID.
          allow create: if request.auth != null && 
                         request.resource.data.created_by_id == request.auth.uid &&
                         // Ensure required fields are present on create
                         request.resource.data.title != null &&
                         request.resource.data.due_date != null &&
                         request.resource.data.priority != null &&
                         request.resource.data.status != null &&
                         request.resource.data.assignee_ids is list && // Ensure assignee_ids is a list (can be empty)
                         request.resource.data.keys().hasAll(['title', 'description', 'due_date', 'priority', 'status', 'assignee_ids', 'created_by_id', 'created_at', 'updated_at']);


          // Update permissions:
          // - The creator can update any field they are allowed to set during creation.
          // - Any authenticated user (implicitly, one who can read the task, like an assignee) can update ONLY the 'status' field.
          allow update: if request.auth != null && (
                          // Creator can update most fields (updated_at is server-controlled)
                          (resource.data.created_by_id == request.auth.uid &&
                           request.resource.data.keys().hasOnly(['title', 'description', 'due_date', 'priority', 'status', 'assignee_ids', 'updated_at'])
                          ) ||
                          // Assignee or other authorized user (with read access) can update only status (and updated_at which is server-set)
                          (
                            (request.auth.uid in resource.data.assignee_ids || resource.data.created_by_id == request.auth.uid) && // Ensures user is related to the task
                            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updated_at'])
                          )
                        );
          
          // Only the creator can delete the task.
          allow delete: if request.auth != null && resource.data.created_by_id == request.auth.uid;
        }
      }
    }
    ```

    **Explanation of Task Rules:**
    *   **`read`**: Authenticated users can read tasks if they are the creator or listed in `assignee_ids`.
    *   **`create`**: Authenticated users can create tasks if the `created_by_id` in the new task data matches their own UID and all required fields are present. `assignee_ids` must be a list (can be empty).
    *   **`update`**:
        *   If the user is the creator (`resource.data.created_by_id == request.auth.uid`), they can update the `title`, `description`, `due_date`, `priority`, `status`, and `assignee_ids`. `updated_at` is also allowed as it's set by `serverTimestamp()`.
        *   If the user is an assignee or the creator (i.e., has read access), they can update *only* the `status` field (and `updated_at`). The `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updated_at'])` part ensures that no other fields are being modified in this case.
    *   **`delete`**: Only the authenticated user who is the creator (`resource.data.created_by_id == request.auth.uid`) can delete the task.

6.  Click **Publish**.

### Data Structure

*   **`profiles` collection:**
    *   Each document ID is the Firebase `uid` of the user.
    *   Fields: `name` (string), `email` (string), `avatar_url` (string, optional).
*   **`tasks` collection:**
    *   Each document has an auto-generated ID.
    *   Fields:
        *   `title` (string)
        *   `description` (string, can be empty)
        *   `due_date` (Timestamp)
        *   `priority` (string: "Low", "Medium", "High")
        *   `status` (string: "To Do", "In Progress", "Done") - "Overdue" is a client-side calculated status based on `due_date` and current time if not "Done".
        *   `assignee_ids` (array of strings, user UIDs, can be empty)
        *   `created_by_id` (string, user UID)
        *   `created_at` (Timestamp, set by server)
        *   `updated_at` (Timestamp, set by server)

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

```