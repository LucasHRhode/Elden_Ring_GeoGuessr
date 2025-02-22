state = 0;
images = [];
x_coordinates = [];
y_coordinates = [];
if (state == 0)
{
    println("Welcome to Elden Ring GeoGuesser!");
    println("Start game");
    if (buttonPress = 1);
    {
        buttonPress = 0;
        state = 1;
    }
}
if (state == 1)
{
    random_index =Math.floor(Math.random() * images.length);
    display(images[random_index]);
    x = x_coordinates[random_index];
    y = y_coordinates[random_index];
    println("Click on the location of this image");
    if (buttonPress = 1)
    {
        buttonPress = 0;
        x_guess = x;
        y_guess = y;
        distance = Math.sqrt((x_guess - x) * (x_guess - x) + (y_guess - y) * (y_guess - y));
        println("Your guess is", distance, "meters away from the correct location");
        if (distance <= 100)
        {
            println("Congratulations! You are within 100 meters of the correct location");
        }
        else if (distance > 100 && distance <= 200)
        {
            println("So close! You were within 100 and 200 meters of the correct location");
        }
        else if (distance > 200)
        {
            println("Too far. Better luck next time");
        }
        println("Would you like to play again?");
        if (buttonPress = 1)
        {
            state = 0;
        }
    }
}

document.addEventListener('mousedown', function(event) {
    const x = event.clientX;
    const y = event.clientY;
    console.log('Mouse Pressed at X:', x, 'Y:', y);
  }); // collects the x and y coordinates of the mouse click
  