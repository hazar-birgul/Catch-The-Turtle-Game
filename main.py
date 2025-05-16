import os
import tkinter as tk
import turtle
import random
import winsound
from PIL import Image, ImageTk

# Constants
SPEED_MAP    = {1: 1000, 2: 1500, 3: 700}
TIME_OPTIONS = [30, 60, 90]
high_score   = 0
move_job     = None
timer_job    = None
muted        = False

# Window
root = tk.Tk()
root.title("Catch the Turtle")
root.geometry("600x700")
root.config(bg="#FFA500")
root.resizable(False, False)

# Frames
menu_frame   = tk.Frame(root, bg="#FFA500")
game_frame   = tk.Frame(root)
timeup_frame = tk.Frame(root, bg="#FFA500")
end_frame    = tk.Frame(root, bg="lightgreen")

# Preload “Time’s Up” Animation Frames
time_img_path   = os.path.join(os.path.dirname(__file__), "time_end.png")
base_time_img   = Image.open(time_img_path).resize((400,300), Image.Resampling.LANCZOS)
time_frames     = [ImageTk.PhotoImage(base_time_img.rotate(angle, expand=True))
                   for angle in range(0, 360, 30)]
static_time_img = ImageTk.PhotoImage(base_time_img)  # static final

timeup_label = tk.Label(timeup_frame, bg=timeup_frame["bg"])
timeup_label.pack(expand=True)

# show_menu — must be defined first
def show_menu():
    global move_job, timer_job
    if move_job:
        ts.ontimer_cancel(move_job)
    if timer_job:
        root.after_cancel(timer_job)
    game_frame.pack_forget()
    timeup_frame.pack_forget()
    end_frame.pack_forget()
    menu_frame.pack(expand=True)

# Game Logic
def start_game(replay=False):
    global move_job, timer_job
    menu_frame.pack_forget()
    end_frame.pack_forget()
    game_frame.pack(expand=True)

    lvl   = level_var.get()
    total = time_var.get()
    score_var.set(0)
    timer_var.set(total)
    high_score_var.set(high_score)

    move_target()
    schedule_move(lvl)
    countdown()

def move_target():
    t.hideturtle()
    half, border = 280, 20
    x = random.randint(-(half-border), half-border)
    y = random.randint(-(half-border), half-border)
    t.goto(x, y)
    t.showturtle()
    ts.update()
    ts.onclick(on_click)

def schedule_move(lvl):
    global move_job
    if move_job:
        ts.ontimer_cancel(move_job)
    move_job = ts.ontimer(lambda: [move_target(), schedule_move(lvl)],
                         SPEED_MAP[lvl])

def on_click(x, y):
    global muted
    if t.distance(x, y) < 20:
        if not muted:
            winsound.PlaySound('click.wav',
                               winsound.SND_FILENAME | winsound.SND_ASYNC)
        score_var.set(score_var.get() + 1)
        move_target()

def countdown():
    global timer_job
    rem = timer_var.get() - 1
    if rem >= 0:
        timer_var.set(rem)
        timer_job = root.after(1000, countdown)
    else:
        trigger_timeup()

# Time‐Up Phase
def trigger_timeup():
    global move_job, timer_job
    if move_job:
        ts.ontimer_cancel(move_job)
    if timer_job:
        root.after_cancel(timer_job)

    game_frame.pack_forget()
    timeup_frame.pack(expand=True)
    animate_spin(0, 0)

def animate_spin(idx, count):
    """Spin for 1 second (10 frames), then show static for 2s."""
    if count < 10:
        timeup_label.config(image=time_frames[idx])
        timeup_frame.after(100, lambda: animate_spin((idx+1)%len(time_frames), count+1))
    else:
        timeup_label.config(image=static_time_img)
        # after 2s, show final end_frame
        timeup_frame.after(2000, show_final_end)

def show_final_end():
    global high_score
    # update high_score
    final = score_var.get()
    if final > high_score:
        high_score = final
    high_score_var.set(high_score)

    timeup_frame.pack_forget()
    end_frame.pack(expand=True)

# MENU FRAME Setup
level_var = tk.IntVar(value=1)
time_var  = tk.IntVar(value=TIME_OPTIONS[0])

# Menu graphic
img_path   = os.path.join(os.path.dirname(__file__), "image_2.png")
menu_img   = Image.open(img_path).resize((200,250), Image.Resampling.LANCZOS)
menu_photo = ImageTk.PhotoImage(menu_img)
tk.Label(menu_frame, image=menu_photo, bg=menu_frame["bg"]).pack(pady=(20,10))

tk.Label(menu_frame, text="Select Level:", font=("Arial",16), bg=menu_frame["bg"])\
  .pack(pady=(10,0))
for lvl in (1,2,3):
    tk.Radiobutton(menu_frame,
                   text=f"Level {lvl}",
                   variable=level_var,
                   value=lvl,
                   font=("Arial",14),
                   bg=menu_frame["bg"])\
      .pack(anchor="w", padx=50)

tk.Label(menu_frame, text="Select Time (s):", font=("Arial",16), bg=menu_frame["bg"])\
  .pack(pady=(20,0))
for t_opt in TIME_OPTIONS:
    tk.Radiobutton(menu_frame,
                   text=f"{t_opt} seconds",
                   variable=time_var,
                   value=t_opt,
                   font=("Arial",14),
                   bg=menu_frame["bg"])\
      .pack(anchor="w", padx=50)

tk.Button(menu_frame,
          text="Play",
          font=("Arial",14),
          width=10,
          command=lambda: start_game()).pack(pady=30)

# GAME FRAME Setup
score_var      = tk.IntVar(value=0)
timer_var      = tk.IntVar(value=0)
high_score_var = tk.IntVar(value=0)
final_score_var= tk.StringVar(value="")

top_bar = tk.Frame(game_frame)
tk.Label(top_bar, text="Time Left:", font=("Arial",14)).pack(side="left", padx=5)
tk.Label(top_bar, textvariable=timer_var, font=("Arial",14)).pack(side="left")

# Mute toggle
on_img  = ImageTk.PhotoImage(Image.open("sound_on.png").resize((24,24), Image.Resampling.LANCZOS))
off_img = ImageTk.PhotoImage(Image.open("sound_off.png").resize((24,24), Image.Resampling.LANCZOS))

def toggle_mute():
    global muted
    muted = not muted
    btn_mute.config(image=(off_img if muted else on_img))

btn_mute = tk.Button(top_bar, image=on_img, bd=0, command=toggle_mute)
btn_mute.pack(side="right", padx=5)

tk.Label(top_bar, textvariable=high_score_var, font=("Arial",14)).pack(side="right")
top_bar.pack(fill="x", pady=5)
tk.Label(top_bar, text="High Score:", font=("Arial",14)).pack(side="right", padx=5)


game_canvas = tk.Canvas(game_frame, width=560, height=560, bg="lightgray")
game_canvas.pack()
ts = turtle.TurtleScreen(game_canvas); ts.bgcolor("lightgray"); ts.tracer(0)
t = turtle.RawTurtle(ts); t.speed(0); t.shape("turtle")
t.color("green"); t.shapesize(2,2); t.penup()

bottom_bar = tk.Frame(game_frame)
tk.Label(bottom_bar, text="Score:", font=("Arial",14)).pack(side="left", padx=5)
tk.Label(bottom_bar, textvariable=score_var, font=("Arial",14)).pack(side="left")
bottom_bar.pack(fill="x", pady=5)

# END FRAME Setup
img2_path = os.path.join(os.path.dirname(__file__), "image.png")
end_img   = Image.open(img2_path).resize((400,300), Image.Resampling.LANCZOS)
play_img  = ImageTk.PhotoImage(end_img)
tk.Label(end_frame, image=play_img, bg=end_frame["bg"]).pack(pady=(20,10))

tk.Label(end_frame, text="Game Over", font=("Arial",24), bg=end_frame["bg"])\
  .pack(pady=(0,5))
tk.Label(end_frame, textvariable=final_score_var, font=("Arial",16), bg=end_frame["bg"])\
  .pack(pady=(0,5))
tk.Label(end_frame, text="High Score: ", font=("Arial",16), bg=end_frame["bg"])\
  .pack()
tk.Label(end_frame, textvariable=high_score_var, font=("Arial",16), bg=end_frame["bg"])\
  .pack(pady=(0,15))

for txt, cmd in (("Replay", lambda: start_game(replay=True)), ("Menu", show_menu)):
    tk.Button(end_frame,
              text=txt,
              font=("Arial",14),
              width=12,
              command=cmd,
              bg="lightgrey",
              fg="black",
              bd=2,
              relief="solid",
              highlightthickness=0)\
      .pack(pady=5)

menu_frame.pack(expand=True)
root.mainloop()
