# Using the official, lightweight Python image
FROM python:3.11-slim

# Configuring environment variables to prevent the creation of .pyc files and log buffering.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Setting the working directory inside the container
WORKDIR /app

# Copying the requirements file and installing dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copying the entire project code into the container
COPY . .

# Exposing port 8000 for external connections
EXPOSE 8000

# Command to run the FastAPI server with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]