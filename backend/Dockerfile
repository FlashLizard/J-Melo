# Dockerfile for the backend

# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /code

# Install system dependencies required by whisperx and ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY ./requirements.txt /code/requirements.txt

# Install any needed packages specified in requirements.txt
# We install torch separately to ensure compatibility
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /code/requirements.txt

# Copy the rest of the backend application code
COPY . /code

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run uvicorn when the container launches
# The host is set to 0.0.0.0 to allow external connections
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

